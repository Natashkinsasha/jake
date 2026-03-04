import { useRef, useState, useCallback } from "react";
import { useCallbackRef } from "./useCallbackRef";

interface QueueItem {
  chunkIndex: number;
  audio: string;
}

interface UseAudioQueueOptions {
  onPlayStart?: () => void;
  onChunkStart?: (chunkIndex: number) => void;
  onAllDone?: () => void;
}

const log = (...args: unknown[]) => { console.log("[AudioQueue]", ...args); };

export function useAudioQueue(options?: UseAudioQueueOptions) {
  const queueRef = useRef<QueueItem[]>([]);
  const playingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const optionsRef = useCallbackRef(options);
  const startedRef = useRef(false);
  const totalEnqueuedRef = useRef(0);
  const playedCountRef = useRef(0);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    queueRef.current = [];
    playingRef.current = false;
    startedRef.current = false;
    totalEnqueuedRef.current = 0;
    playedCountRef.current = 0;
    setIsPlaying(false);
  }, []);

  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      reset();
      log("queue empty, all done");
      optionsRef.current?.onAllDone?.();
      return;
    }

    // Sort by chunkIndex and take the first
    queueRef.current.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const item = queueRef.current.shift();
    if (!item) return;

    if (!item.audio) {
      playedCountRef.current++;
      optionsRef.current?.onChunkStart?.(item.chunkIndex);
      log(`chunk ${item.chunkIndex}: no audio, skipping`);
      playNext();
      return;
    }

    cleanup();

    try {
      const binaryString = atob(item.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        playedCountRef.current++;
        log(`chunk ${item.chunkIndex}: ended`);
        cleanup();
        playNext();
      };
      audio.onerror = () => {
        playedCountRef.current++;
        log(`chunk ${item.chunkIndex}: error`);
        cleanup();
        playNext();
      };

      optionsRef.current?.onChunkStart?.(item.chunkIndex);
      log(`chunk ${item.chunkIndex}: playing (${blob.size} bytes)`);
      audio.play().catch(() => {
        log(`chunk ${item.chunkIndex}: play() rejected`);
        cleanup();
        playNext();
      });
    } catch {
      log(`chunk ${item.chunkIndex}: decode error`);
      playNext();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- optionsRef is stable
  }, [cleanup, reset]);

  const enqueue = useCallback((item: QueueItem) => {
    queueRef.current.push(item);
    totalEnqueuedRef.current++;
    log(`enqueued chunk ${item.chunkIndex}, queue size: ${queueRef.current.length}`);

    if (!startedRef.current) {
      startedRef.current = true;
      optionsRef.current?.onPlayStart?.();
    }

    if (!playingRef.current) {
      playingRef.current = true;
      setIsPlaying(true);
      playNext();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- optionsRef is stable
  }, [playNext]);

  const stop = useCallback((): number => {
    const total = totalEnqueuedRef.current;
    if (total === 0) { reset(); cleanup(); return 1; }

    let chunkProgress = 0;
    if (audioRef.current) {
      const { currentTime, duration } = audioRef.current;
      if (duration > 0 && Number.isFinite(duration)) {
        chunkProgress = currentTime / duration;
      }
    }

    const progress = Math.min((playedCountRef.current + chunkProgress) / total, 1);
    reset();
    cleanup();
    log("stopped, overall progress:", progress.toFixed(2));
    return progress;
  }, [cleanup, reset]);

  const clear = useCallback(() => {
    queueRef.current = [];
    log("cleared");
  }, []);

  return { enqueue, stop, clear, isPlaying };
}
