"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { TutorAvatar } from "./TutorAvatar";
import { ChatHistory } from "./ChatHistory";
import { LessonConnecting } from "./LessonConnecting";
import { useLessonState } from "@/hooks/useLessonState";
import { useStudentStt } from "@/hooks/useStudentStt";
import { useRouter } from "next/navigation";
import { useTabFocus } from "@/hooks/useTabFocus";

const SILENCE_MS = 1000; // send after 1s of silence

interface LessonScreenProps {
  token?: string | null;
}

export function LessonScreen({ token }: LessonScreenProps) {
  const router = useRouter();
  const {
    lessonId,
    messages,
    currentExercise,
    status,
    connected,
    isPlaying,
    lessonEnded: serverLessonEnded,
    sendText,
    submitExerciseAnswer,
    endLesson,
    interruptTutor,
    stopAudio,
    playPending,
    setUserSpeaking,
  } = useLessonState(token);

  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const micReadyRef = useRef(false);
  const isPlayingRef = useRef(false);
  const audioStoppedAtRef = useRef(0);
  if (isPlaying) {
    isPlayingRef.current = true;
  } else if (isPlayingRef.current) {
    // Just stopped playing → record timestamp for echo cooldown
    isPlayingRef.current = false;
    audioStoppedAtRef.current = Date.now();
  }

  const bufferRef = useRef<string[]>([]);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasReceivedFirstMessage = messages.some(
    (msg) => msg.role === "assistant",
  );

  // Lesson timer
  useEffect(() => {
    if (!hasReceivedFirstMessage) return;
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [hasReceivedFirstMessage]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Send all accumulated text as one message
  const flush = useCallback(() => {
    const text = bufferRef.current.join(" ").trim();
    bufferRef.current = [];
    sendTimerRef.current = null;
    if (text) {
      console.log("[Lesson] flush →", text);
      setLiveTranscript("");
      sendText(text);
    }
    // User finished speaking — allow tutor messages again
    setUserSpeaking(false);
  }, [sendText, setUserSpeaking]);

  const stt = useStudentStt({
    onSegment: (text: string) => {
      // Confirmed real speech — block tutor messages
      setUserSpeaking(true);

      // If tutor is playing or just finished (<1s ago) → interrupt
      if (isPlayingRef.current) {
        interruptTutor();
        bufferRef.current = [];
        setLiveTranscript("");
        if (sendTimerRef.current) {
          clearTimeout(sendTimerRef.current);
          sendTimerRef.current = null;
        }
      }

      // Add to buffer, reset silence timer
      bufferRef.current.push(text);
      setLiveTranscript(bufferRef.current.join(" "));

      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
      sendTimerRef.current = setTimeout(flush, SILENCE_MS);
    },
  });

  // Enable STT only after tutor's first message arrived
  useEffect(() => {
    if (hasReceivedFirstMessage && !isMuted && !isPaused && !stt.isEnabled && !micReadyRef.current) {
      stt.enable();
      micReadyRef.current = true;
    }
  }, [hasReceivedFirstMessage, isMuted, isPaused, stt]);

  // Play pending first message after mic is ready
  useEffect(() => {
    if (stt.isEnabled && playPending) {
      const timer = setTimeout(() => playPending(), 500);
      return () => clearTimeout(timer);
    }
  }, [stt.isEnabled, playPending]);

  // Pause audio when tab loses focus
  useTabFocus({
    onBlur: () => stopAudio(),
  });

  // Show interim transcript in real-time
  useEffect(() => {
    if (stt.finalText) {
      const combined = [...bufferRef.current, stt.finalText].join(" ");
      setLiveTranscript(combined);
    }
  }, [stt.finalText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    };
  }, []);

  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      // Resume
      setIsPaused(false);
      if (!isMuted) stt.enable();
    } else {
      // Pause everything — stop audio, stop recording
      setIsPaused(true);
      stopAudio();
      stt.disable();
      bufferRef.current = [];
      setLiveTranscript("");
      if (sendTimerRef.current) {
        clearTimeout(sendTimerRef.current);
        sendTimerRef.current = null;
      }
    }
  }, [isPaused, isMuted, stt, stopAudio]);

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      if (!isPaused) stt.enable();
    } else {
      setIsMuted(true);
      stt.disable();
    }
  }, [isMuted, isPaused, stt]);

  const handleEndLesson = useCallback(() => {
    stt.disable();
    stopAudio();
    flush();
    endLesson();
    router.push("/dashboard");
  }, [endLesson, stt, flush, router, stopAudio]);

  // Server ended the lesson — redirect
  useEffect(() => {
    if (serverLessonEnded) {
      stt.disable();
      stopAudio();
      router.push("/dashboard");
    }
  }, [serverLessonEnded, stt, router, stopAudio]);

  if (!connected) return <LessonConnecting />;

  if (!hasReceivedFirstMessage) {
    return (
      <div className="min-h-screen lesson-gradient flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2.5 h-2.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2.5 h-2.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-white/40 text-sm">Jake is getting ready...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen lesson-gradient flex flex-col overflow-hidden">
      {/* Header — always visible */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 pt-safe">
        <span className="text-white/80 text-lg font-mono w-20">{formatTime(elapsed)}</span>
        <h1 className="text-white font-semibold">Lesson with Jake</h1>
        <button
          onClick={handleEndLesson}
          className="bg-red-500/80 hover:bg-red-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          End lesson
        </button>
      </div>

      {/* Avatar area */}
      <div className="flex-shrink-0 flex flex-col items-center py-4">
        <TutorAvatar isSpeaking={status === "speaking"} />
        <p className="text-white/80 text-sm mt-2 font-medium">Jake</p>
      </div>

      {/* Chat history */}
      <ChatHistory
        messages={messages}
        isThinking={status === "thinking"}
        isSpeaking={isPlaying || status === "speaking"}
        currentExercise={currentExercise}
        onSubmitExercise={submitExerciseAnswer}
      />

      {/* Live transcript */}
      {liveTranscript && (
        <div className="px-4 pb-2">
          <p className="text-white/50 text-sm italic text-center">{liveTranscript}</p>
        </div>
      )}

      {/* Bottom bar — always visible */}
      <div className="flex-shrink-0 bg-white/10 backdrop-blur-md border-t border-white/20 p-4">
        <div className="flex items-center justify-center gap-6">
          {/* Pause/Resume — stops everything */}
          <button
            onClick={handleTogglePause}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isPaused
                ? "bg-green-500 hover:bg-green-400"
                : "bg-white/20 hover:bg-white/30"
            }`}
            aria-label={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>

          {/* Mic toggle */}
          <button
            onClick={handleToggleMute}
            disabled={isPaused}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isPaused
                ? "bg-gray-500 opacity-50"
                : isMuted
                  ? "bg-yellow-500 shadow-lg shadow-yellow-500/30 hover:bg-yellow-400"
                  : "bg-green-500 shadow-lg shadow-green-500/30 scale-105 hover:bg-green-400"
            }`}
          >
            {isMuted || isPaused ? (
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9l4.17 4.18L21 19.73 4.27 3z"/>
              </svg>
            ) : (
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-white/50 text-xs text-center mt-2">
          {isPaused ? "Paused" : isMuted ? "Microphone off" : "Listening..."}
        </p>
      </div>
    </div>
  );
}
