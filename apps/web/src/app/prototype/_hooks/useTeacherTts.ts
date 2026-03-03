"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
}

interface UseTeacherTtsReturn {
  speak: (text: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  visibleText: string;
  fullText: string;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
}

export function useTeacherTts(): UseTeacherTtsReturn {
  const [visibleText, setVisibleText] = useState("");
  const [fullText, setFullText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordsRef = useRef<WordTiming[]>([]);
  const rafRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  const updateVisibleText = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused || audio.ended) return;

    const currentTime = audio.currentTime;
    const words = wordsRef.current;

    const visibleWords: string[] = [];
    for (const w of words) {
      if (currentTime >= w.startTime) {
        visibleWords.push(w.word);
      } else {
        break;
      }
    }

    setVisibleText(visibleWords.join(" "));
    rafRef.current = requestAnimationFrame(updateVisibleText);
  }, []);

  const stop = useCallback(() => {
    generationRef.current++;

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoading(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      stop();

      const gen = generationRef.current;
      const abort = new AbortController();
      abortRef.current = abort;

      setIsLoading(true);
      setFullText(text);
      setVisibleText("");

      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: abort.signal,
        });

        // Stale response — a newer speak() was called
        if (gen !== generationRef.current) return;

        if (!response.ok) {
          throw new Error(`TTS API error: ${response.status}`);
        }

        const data = (await response.json()) as {
          audioBase64: string;
          words: WordTiming[];
        };
        if (gen !== generationRef.current) return;

        const { audioBase64, words } = data as {
          audioBase64: string;
          words: WordTiming[];
        };

        wordsRef.current = words;

        const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
        audioRef.current = audio;

        audio.addEventListener("play", () => {
          if (gen !== generationRef.current) return;
          setIsPlaying(true);
          setIsPaused(false);
          rafRef.current = requestAnimationFrame(updateVisibleText);
        });

        audio.addEventListener("pause", () => {
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
        });

        audio.addEventListener("ended", () => {
          if (gen !== generationRef.current) return;
          setIsPlaying(false);
          setIsPaused(false);
          setVisibleText(words.map((w) => w.word).join(" "));
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
        });

        setIsLoading(false);
        await audio.play();
      } catch (error) {
        if (gen !== generationRef.current) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("TTS error:", error);
        setIsLoading(false);
        setVisibleText(text);
      }
    },
    [stop, updateVisibleText]
  );

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current?.paused) {
      void audioRef.current.play();
      setIsPaused(false);
    }
  }, []);

  useEffect(() => () => { stop(); }, [stop]);

  return {
    speak,
    pause,
    resume,
    stop,
    visibleText,
    fullText,
    isPlaying,
    isPaused,
    isLoading,
  };
}
