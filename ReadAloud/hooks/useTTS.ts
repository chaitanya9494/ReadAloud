import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';

interface TTSOptions {
  rate?: number;
  pitch?: number;
  voice?: string;
  /** Called with the character index of the current word being spoken */
  onWordChange?: (charIndex: number) => void;
  /** If true, attempt word-level callbacks (falls back to sentence-level) */
  wordLevel?: boolean;
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
 * When wordLevel is true, uses Speech boundary events (Android onBoundary)
 * to provide word-level highlight positions. Falls back to sentence-level
 * on devices that don't support it.
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

  const speakChunk = useCallback((index: number) => {
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
      // Word-level boundary callback (Android 8+ supports this)
      onBoundary: opts.wordLevel
        ? (event: any) => {
            // event contains charIndex and charLength relative to the spoken chunk
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
          speakChunk(index + 1);
        }
      },
      onStopped: () => {},
    } as any); // Cast needed because onBoundary isn't in expo-speech types yet
  }, []);

  const play = useCallback(
    (fromChunk?: number) => {
      isStopping.current = false;
      Speech.stop();
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
