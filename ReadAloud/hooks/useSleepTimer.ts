import { useCallback, useEffect, useRef, useState } from 'react';

interface SleepTimerState {
  isActive: boolean;
  remainingSeconds: number;
  totalMinutes: number | null;
}

export function useSleepTimer(onExpire: () => void) {
  const [state, setState] = useState<SleepTimerState>({
    isActive: false,
    remainingSeconds: 0,
    totalMinutes: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const start = useCallback((minutes: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const totalSeconds = minutes * 60;
    setState({ isActive: true, remainingSeconds: totalSeconds, totalMinutes: minutes });

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        const next = prev.remainingSeconds - 1;
        if (next <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onExpireRef.current();
          return { isActive: false, remainingSeconds: 0, totalMinutes: null };
        }
        return { ...prev, remainingSeconds: next };
      });
    }, 1000);
  }, []);

  const cancel = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState({ isActive: false, remainingSeconds: 0, totalMinutes: null });
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const formatRemaining = () => {
    const m = Math.floor(state.remainingSeconds / 60);
    const s = state.remainingSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return { ...state, start, cancel, formatRemaining };
}
