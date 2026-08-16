import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import * as EdgeTTS from '@/utils/edgeTTS';
import { synthesize, playWav, stopPlayback } from '@/utils/piperTTS';
import {
  initSherpaTTS,
  sherpaSpeak,
  sherpaStop,
  isModelReady,
  extractBundledModel,
} from '@/utils/sherpaTTS';
import type { TTSEngine } from '@/utils/storage';
import { logEvent } from '@/utils/analytics';

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
  /** Edge TTS voice identifier (e.g. "en-US-AriaNeural") */
  edgeVoiceId?: string;
  /** Sherpa-ONNX speaker ID (number) */
  sherpaVoiceId?: number;
  /** Callback for sherpa model download progress */
  onSherpaDownloadProgress?: (percent: number) => void;
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
  const sherpaInited = useRef(false);
  const edgeFallbackActive = useRef(false);
  optionsRef.current = options;

  useEffect(() => {
    chunks.current = splitIntoSpeakableChunks(fullText);
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
      onError: (event: any) => {
        console.warn('[SystemTTS] playback failed', event);
        logEvent('tts_error', { engine: 'system' });
        setState((s) => ({ ...s, isPlaying: false, isPaused: false }));
      },
    } as any);
  }, []);

  // ── Sherpa engine: on-device neural TTS per chunk ──
  const speakChunkSherpa = useCallback(async (index: number) => {
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
      if (!sherpaInited.current) {
        if (!(await isModelReady())) {
          opts.onSherpaDownloadProgress?.(0);
          await extractBundledModel((p) => opts.onSherpaDownloadProgress?.(p));
        }
        await initSherpaTTS();
        sherpaInited.current = true;
      }

      sherpaSpeak(chunk.text, {
        voiceId: opts.sherpaVoiceId ?? 0,
        rate: opts.rate ?? 1.0,
        onDone: () => {
          if (!isStopping.current) {
            speakChunkSherpa(index + 1);
          }
        },
        onError: (err: Error) => {
          console.warn('[TTS] Sherpa TTS failed:', err.message);
          setState((s) => ({ ...s, isPlaying: false, isPaused: false }));
        },
      });
    } catch (err) {
      console.warn('[TTS] Sherpa init/speak failed:', err);
      setState((s) => ({ ...s, isPlaying: false, isPaused: false }));
    }
  }, []);

  // ── Edge engine: Microsoft Edge neural TTS per chunk ──
  const speakChunkEdge = useCallback((index: number) => {
    if (edgeFallbackActive.current) {
      speakChunkSystem(index);
      return;
    }
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

    EdgeTTS.speak(chunk.text, {
      rate: opts.rate ?? 1.0,
      voice: opts.edgeVoiceId || 'en-US-AriaNeural',
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
          speakChunkEdge(index + 1);
        }
      },
      onError: (err: Error) => {
        console.warn('[TTS] Edge TTS failed:', err.message);
        // Keep reading when connectivity drops: Android's built-in engine is
        // the offline fallback and does not require the Edge service.
        edgeFallbackActive.current = true;
        Speech.speak(chunk.text, {
          rate: opts.rate ?? 1.0,
          pitch: opts.pitch ?? 1.0,
          onDone: () => {
            if (!isStopping.current) speakChunkSystem(index + 1);
          },
          onStopped: () => setState((s) => ({ ...s, isPlaying: false, isPaused: false })),
          onError: () => setState((s) => ({ ...s, isPlaying: false, isPaused: false })),
        } as any);
      },
      onStopped: () => {},
    } as any);
  }, [speakChunkSystem]);

  // Android Device Voices are the only production playback path. Do not let
  // persisted legacy selections re-enable a cloud/server audio engine.
  const speakChunk = useCallback(
    (index: number) => {
      return speakChunkSystem(index);
    },
    [speakChunkSystem]
  );

  const play = useCallback(
    (fromChunk?: number) => {
      isStopping.current = false;
      edgeFallbackActive.current = false;
      Speech.stop();
      EdgeTTS.stop();
      stopPlayback();
      sherpaStop();
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
    EdgeTTS.stop();
    sherpaStop();
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
    EdgeTTS.stop();
    sherpaStop();
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
      EdgeTTS.stop();
      sherpaStop();
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

/**
 * Edge's WebSocket endpoint has a practical per-request size limit. More
 * importantly, keeping chunks small avoids retaining a large compressed audio
 * response and its decoded PCM representation at the same time on low-memory
 * devices. Prefer sentence boundaries, then whitespace, while retaining the
 * original character offsets used for bookmarks and highlighting.
 */
function splitIntoSpeakableChunks(text: string, maxLength = 850) {
  if (!text) return [];

  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  const result: { text: string; startIndex: number }[] = [];
  let sentenceStart = 0;

  for (const sentence of sentences) {
    let start = 0;

    while (start < sentence.length) {
      let end = Math.min(start + maxLength, sentence.length);

      // Keep words intact whenever possible. A single very long token still
      // needs to be split so it cannot make the TTS request unbounded.
      if (end < sentence.length) {
        const breakAt = Math.max(
          sentence.lastIndexOf(' ', end),
          sentence.lastIndexOf('\n', end),
          sentence.lastIndexOf('\t', end),
        );
        if (breakAt > start) end = breakAt + 1;
      }

      result.push({
        text: sentence.slice(start, end),
        startIndex: sentenceStart + start,
      });
      start = end;
    }

    sentenceStart += sentence.length;
  }

  return result;
}
