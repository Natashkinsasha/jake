import { useEffect, useRef, useState } from "react";

export function useElapsedTimer(active: boolean, startedAt?: number | null) {
  const offsetRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  // When startedAt changes (e.g. lesson_resumed), compute initial offset
  useEffect(() => {
    if (startedAt != null && startedAt > 0) {
      offsetRef.current = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(offsetRef.current);
    }
  }, [startedAt]);

  useEffect(() => {
    if (!active) return;
    setElapsed(offsetRef.current);
    const interval = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [active]);

  return elapsed;
}
