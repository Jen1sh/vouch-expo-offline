import { useCallback, useEffect, useState } from 'react';

/**
 * Counts down from `seconds` to 0, ticking once per second. Returns the
 * remaining time and a `reset` for restarting the countdown (e.g. after a
 * resend press). The interval is cleared at 0 and on unmount.
 */
export function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      return;
    }
    const interval = setInterval(() => {
      setRemaining((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [remaining]);

  const reset = useCallback((nextSeconds: number = seconds) => {
    setRemaining(nextSeconds);
  }, [seconds]);

  return { remaining, isRunning: remaining > 0, reset };
}