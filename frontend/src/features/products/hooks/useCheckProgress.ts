import { useState, useEffect } from 'react';

interface CheckProgressResult {
  progress: number;
  timeRemaining: string;
  isComplete: boolean;
}

/**
 * Calculates check progress (0-100%) and formatted time remaining
 * until the next price scrape interval.
 */
export function useCheckProgress(
  lastChecked: string | Date | null | undefined,
  nextCheckAt: string | Date | null | undefined,
  isPaused: boolean = false
): CheckProgressResult {
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (isPaused) {
      setProgress(0);
      setTimeRemaining('Paused');
      return;
    }

    const calculateProgress = () => {
      if (!nextCheckAt || !lastChecked) {
        setProgress(100);
        setTimeRemaining('Soon');
        return;
      }

      const lastCheckedTime = new Date(lastChecked).getTime();
      const nextCheckTime = new Date(nextCheckAt).getTime();
      const now = Date.now();
      const totalDuration = nextCheckTime - lastCheckedTime;
      const elapsed = now - lastCheckedTime;
      const remaining = nextCheckTime - now;

      const progressPercent = totalDuration > 0
        ? Math.min((elapsed / totalDuration) * 100, 100)
        : 100;
      setProgress(progressPercent);

      if (progressPercent >= 100 && !isComplete) {
        setIsComplete(true);
        setTimeout(() => setIsComplete(false), 1500);
      }

      if (remaining <= 0) {
        setTimeRemaining('Soon');
      } else {
        const seconds = Math.floor(remaining / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes % 60}m`);
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes}m`);
        } else {
          setTimeRemaining('< 1m');
        }
      }
    };

    calculateProgress();
    const interval = setInterval(calculateProgress, 1000);
    return () => clearInterval(interval);
  }, [lastChecked, nextCheckAt, isPaused, isComplete]);

  return { progress, timeRemaining, isComplete };
}
