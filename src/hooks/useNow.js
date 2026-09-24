import { useEffect, useState } from 'react';

/** Ticks every `interval` ms and returns the current Date (for live clocks/timers). */
export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}