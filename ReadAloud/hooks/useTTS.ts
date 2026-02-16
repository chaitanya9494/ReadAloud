import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { synthesize, playWav, stopPlayback } from '@/utils/piperTTS';
import type { TTSEngine } from '@/utils/storage';

interface TTSOptions {
  rate?: number;
  pitch?: number;
  voice?: string;
  /** Called with the character index of the current word being spoken */
  onWordChange?: (charIndex: number) => void;
  /** If true, attempt word-level callbacks (falls back to sentence-level) */
  wordLevel?: boolean;
  /** TTS engine to use */
  engine?: TTSEngine;
  /** Piper voice model ID */
  piperVoiceId?: string;
  /** Piper server URL */
  piperServerUrl?: string;
}

interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  currentIndex: number;
  chunkIndex: number;
  /** Character offset of the currently spoken word within the full text */
  wordCharIndex: number;
  /** Length of the currently highlighted word */
  wordLength: number;
}

/**
 * Core TTS hook. Splits text into sentences and reads them
 * sequentially so we can track position, pause/resume, and
 * skip forward/back by sentence.
 *
 * Supports two engines:
 * - 'system' (default): expo-speech with word-level boundary events
 * - 'piper': Piper HTTP server — synthesizes WAV per sentence, plays via expo-av
 */
export function useTTS(fullText: string, options: TTSOptions = {}) {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    currentIndex: 0,
    chunkIndex: 0,
    wordCharIndex: 0,
    wordLength: 0,
  });

  const chunks = useRef<{ text: string; startIndex: number }[]>([]);
  const currentChunk = useRef(0);
  const isStopping = useRef(false);
  const optionsRef = useRef(options);
  const piperCleanup = useRef<(() => void) | null>(null);
  optionsRef.current = options;

  useEffect(() => {
    if (!fullText) {
      chunks.current = [];
      return;
    }
    const sentences = fullText.match(/[^.!?\n]+[.!?\n]*/g) || [fullText];
    let offset = 0;
    chunks.current = sentences.map((s) => {
      const chunk = { text: s, startIndex: offset };
      offset += s.length;
      return chunk;
    });
  }, [fullText]);

  // ── Piper engine: synthesize + play WAV per chunk ──
  const speakChunkPiper = useCallback(async (index: number) => {
    if (index >= chunks.current.length) {
      setState((s) => ({ ...s, isPlaying: false, isPaused: false }));
      return;
    }

    const chunk = chunks.current[index];
    const opts = optionsRef.current;
    currentChunk.current = index;

    setState((s) => ({
      ...s,
      isPlaying: true,
      isPaused: false,
      chunkIndex: index,
      currentIndex: chunk.startIndex,
      wordCharIndex: chunk.startIndex,
      wordLength: 0,
    }));

    opts.onWordChange?.(chunk.startIndex);

    try {
      const wavUri = await synthesize({
        serverUrl: opts.piperServerUrl || 'http://localhost:5000',
        voice: opts.piperVoiceId || 'en_US-lessac-medium',
        text: chunk.text.trim(),
        rate: opts.rate ?? 1.0,
      });

      if (isStopping.current) return;

      piperCleanup.current = await playWav(wavUri, () => {
        piperCleanup.current = null;
        if (!isStopping.current) {
          speakChunkPiper(index + 1);
        }
      });
    } catch (err) {
      console.warn('[PiperTTS] synthesis failed:', err);
      setState((s) => ({ ...s, isPlaying: false, isPaused: false }));
    }
  }, []);

  // ── System engine: expo-speech per chunk ──
  const speakChunkSystem = useCallback((index: number) => {
    if (index >= chunks.current.length) {
      setState((s) => ({ ...s, isPlaying: false, isPaused: false }));
      return;
    }

    const chunk = chunks.current[index];
    const opts = optionsRef.current;
    currentChunk.current = index;

    setState((s) => ({
      ...s,
      isPlaying: true,
      isPaused: false,
      chunkIndex: index,
      currentIndex: chunk.startIndex,
      wordCharIndex: chunk.startIndex,
      wordLength: 0,
    }));

    opts.onWordChange?.(chunk.startIndex);

    Speech.speak(chunk.text, {
      rate: opts.rate ?? 1.0,
      pitch: opts.pitch ?? 1.0,
      voice: opts.voice,
      onBoundary: opts.wordLevel
        ? (event: any) => {
            if (event && typeof event.charIndex === 'number') {
              const absoluteIndex = chunk.startIndex + event.charIndex;
              const wordLen = event.charLength || 0;
              setState((s) => ({
                ...s,
                wordCharIndex: absoluteIndex,
                wordLength: wordLen,
              }));
              opts.onWordChange?.(absoluteIndex);
            }
          }
        : undefined,
      onDone: () => {
        if (!isStopping.current) {
          speakChunkSystem(index + 1);
        }
      },
      onStopped: () => {},
    } as any);
  }, []);

  const speakChunk = useCallback(
    (index: number) => {
      const engine = optionsRef.current.engine ?? 'system';
      if (engine === 'piper') {
        speakChunkPiper(index);
      } else {
        speakChunkSystem(index);
      }
    },
    [speakChunkPiper, speakChunkSystem]
  );

  const play = useCallback(
    (fromChunk?: number) => {
      isStopping.current = false;
      // Stop both engines
      Speech.stop();
      stopPlayback();
      piperCleanup.current = null;
      const startAt = fromChunk ?? currentChunk.current;
      setTimeout(() => speakChunk(startAt), 50);
    },
    [speakChunk]
  );

  const playFromPosition = useCallback(
    (charIndex: number) => {
      const idx = chunks.current.findIndex(
        (c, i) =>
          charIndex >= c.startIndex &&
          (i === chunks.current.length - 1 ||
            charIndex < chunks.current[i + 1].startIndex)
      );
      play(idx >= 0 ? idx : 0);
    },
    [play]
  );

  const pause = useCallback(() => {
    isStopping.current = true;
    Speech.stop();
    stopPlayback();
    piperCleanup.current = null;
    setState((s) => ({ ...s, isPlaying: false, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    play(currentChunk.current);
  }, [play]);

  const skipForward = useCallback(() => {
    const next = Math.min(currentChunk.current + 1, chunks.current.length - 1);
    play(next);
  }, [play]);

  const skipBack = useCallback(() => {
    const prev = Math.max(currentChunk.current - 1, 0);
    play(prev);
  }, [play]);

  const stop = useCallback(() => {
    isStopping.current = true;
    Speech.stop();
    stopPlayback();
    piperCleanup.current = null;
    currentChunk.current = 0;
    setState({
      isPlaying: false,
      isPaused: false,
      currentIndex: 0,
      chunkIndex: 0,
      wordCharIndex: 0,
      wordLength: 0,
    });
  }, []);

  useEffect(() => {
    return () => {
      isStopping.current = true;
      Speech.stop();
      stopPlayback();
    };
  }, []);

  const progress =
    chunks.current.length > 0
      ? currentChunk.current / chunks.current.length
      : 0;

  return {
    ...state,
    progress,
    totalChunks: chunks.current.length,
    play,
    playFromPosition,
    pause,
    resume,
    skipForward,
    skipBack,
    stop,
  };
}
