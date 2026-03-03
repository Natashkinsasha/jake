import { useRef, useState, useCallback } from "react";
import { useCallbackRef } from "./useCallbackRef";

interface UseAudioPlayerOptions {
  onPlay?: () => void;
  onEnd?: () => void;
}

const log = (...args: unknown[]) => console.log("[AudioPlayer]", ...args);

// Unlock audio on user gesture — call this from mic permission handler
export function unlockAudio() {
  // Create and immediately resume a silent audio context
  try {
    const ctx = new AudioContext();
    ctx.resume().then(() => {
      log("AudioContext unlocked, state:", ctx.state);
      ctx.close();
    });
  } catch {}
}

export function useAudioPlayer(options?: UseAudioPlayerOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const optionsRef = useCallbackRef(options);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const fallbackFiredRef = useRef(false);

  const play = useCallback((audioBase64: string) => {
    fallbackFiredRef.current = false;

    const fireFallback = () => {
      if (fallbackFiredRef.current) return;
      fallbackFiredRef.current = true;
      optionsRef.current?.onPlay?.();
      optionsRef.current?.onEnd?.();
    };

    try {
      cleanup();

      if (!audioBase64) {
        log("empty audio data, skipping");
        fireFallback();
        return;
      }

      log(`decoding ${audioBase64.length} chars of base64`);

      // Convert base64 to Blob URL (more reliable than data URIs for large audio)
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;

      log(`blob created: ${blob.size} bytes, url: ${url}`);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        const dur = audio.duration;
        if (Number.isFinite(dur)) {
          setDuration(dur);
          log("duration:", dur.toFixed(2), "s");
        }
      };
      audio.onplay = () => {
        setIsPlaying(true);
        log("playback started");
        optionsRef.current?.onPlay?.();
      };
      audio.onended = () => {
        setIsPlaying(false);
        cleanup();
        log("playback ended");
        optionsRef.current?.onEnd?.();
      };
      audio.onerror = (e) => {
        log("playback error:", e);
        setIsPlaying(false);
        cleanup();
        fireFallback();
      };
      audio.onpause = () => setIsPlaying(false);

      audio.play().catch((e) => {
        log("play() rejected:", e.message);
        fireFallback();
      });
    } catch (e) {
      log("play error:", e);
      fireFallback();
    }
  }, [cleanup]);

  const stop = useCallback((): number => {
    let progress = 1;
    if (audioRef.current) {
      const { currentTime, duration } = audioRef.current;
      if (duration > 0 && Number.isFinite(duration)) {
        progress = currentTime / duration;
      }
      setIsPlaying(false);
      cleanup();
      log("stopped at", `${(progress * 100).toFixed(0)}%`);
    }
    return progress;
  }, [cleanup]);

  return { isPlaying, duration, play, stop };
}
