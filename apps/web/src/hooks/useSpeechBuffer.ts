import { useCallback, useEffect, useMemo, useRef } from "react";
import { getSilenceDuration } from "@/lib/silence-duration";

interface UseSpeechBufferOptions {
  onFlush: (text: string) => void;
  onSpeechDone: () => void;
}

export function useSpeechBuffer({ onFlush, onSpeechDone }: UseSpeechBufferOptions) {
  const bufferRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const text = bufferRef.current.join(" ").trim();
    bufferRef.current = [];
    timerRef.current = null;
    if (text) {
      onFlush(text);
    }
    onSpeechDone();
  }, [onFlush, onSpeechDone]);

  const push = useCallback(
    (segment: string) => {
      bufferRef.current.push(segment);
      if (timerRef.current) clearTimeout(timerRef.current);
      const silenceMs = getSilenceDuration(segment);
      timerRef.current = setTimeout(flush, silenceMs);
    },
    [flush],
  );

  const clear = useCallback(() => {
    bufferRef.current = [];
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const getText = useCallback(() => {
    return bufferRef.current.join(" ");
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useMemo(() => ({ push, clear, flush, getText }), [push, clear, flush, getText]);
}
