"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { TutorAvatar } from "./TutorAvatar";
import { ChatHistory } from "./ChatHistory";
import { LessonConnecting } from "./LessonConnecting";
import { useLessonState } from "@/hooks/useLessonState";
import { useStudentStt } from "@/hooks/useStudentStt";
import { useRouter } from "next/navigation";

const SEND_DELAY = 2000; // wait 2s of silence before sending

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
  } = useLessonState(token);

  const [isMuted, setIsMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const micReadyRef = useRef(false);

  // Accumulation buffer for STT segments
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

  // Flush buffer — send accumulated text to backend
  const flushBuffer = useCallback(() => {
    const text = bufferRef.current.join(" ").trim();
    bufferRef.current = [];
    if (sendTimerRef.current) {
      clearTimeout(sendTimerRef.current);
      sendTimerRef.current = null;
    }
    if (text) {
      setLiveTranscript("");
      sendText(text);
    }
  }, [sendText]);

  const stt = useStudentStt({
    onSpeechStart: () => {
      // User starts speaking — interrupt tutor, cancel pending send timer
      interruptTutor();
      if (sendTimerRef.current) {
        clearTimeout(sendTimerRef.current);
        sendTimerRef.current = null;
      }
    },
  });

  // Enable STT as soon as connected
  useEffect(() => {
    if (connected && !isMuted && !stt.isEnabled && !micReadyRef.current) {
      stt.enable();
      micReadyRef.current = true;
    }
  }, [connected, isMuted, stt]);

  // Play pending first message after mic is ready
  useEffect(() => {
    if (stt.isEnabled && playPending) {
      const timer = setTimeout(() => playPending(), 500);
      return () => clearTimeout(timer);
    }
  }, [stt.isEnabled, playPending]);

  // Show live transcript (interim results)
  useEffect(() => {
    if (stt.finalText) {
      const combined = [...bufferRef.current, stt.finalText].join(" ");
      setLiveTranscript(combined);
    }
  }, [stt.finalText]);

  // On speech_final — add to buffer, start debounce timer
  const lastAddedRef = useRef("");
  useEffect(() => {
    if (stt.finalText && !stt.isProcessing && stt.finalText !== lastAddedRef.current) {
      lastAddedRef.current = stt.finalText;
      bufferRef.current.push(stt.finalText);

      // Show accumulated text
      setLiveTranscript(bufferRef.current.join(" "));

      // Reset debounce timer
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
      sendTimerRef.current = setTimeout(flushBuffer, SEND_DELAY);
    }
  }, [stt.finalText, stt.isProcessing, flushBuffer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      stt.enable();
    } else {
      setIsMuted(true);
      stt.disable();
      // Flush any buffered text before muting
      flushBuffer();
    }
  }, [isMuted, stt, flushBuffer]);

  const handleEndLesson = useCallback(() => {
    stt.disable();
    flushBuffer();
    endLesson();
    router.push("/dashboard");
  }, [endLesson, stt, flushBuffer, router]);

  // Server ended the lesson — redirect
  useEffect(() => {
    if (serverLessonEnded) {
      stt.disable();
      router.push("/dashboard");
    }
  }, [serverLessonEnded, stt, router]);

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
    <div className="min-h-screen lesson-gradient flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-safe">
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
      <div className="flex flex-col items-center py-4">
        <TutorAvatar isSpeaking={status === "speaking"} />
        <p className="text-white/80 text-sm mt-2 font-medium">Jake</p>
      </div>

      {/* Chat history */}
      <ChatHistory
        messages={messages}
        isThinking={status === "thinking"}
        currentExercise={currentExercise}
        onSubmitExercise={submitExerciseAnswer}
      />

      {/* Live transcript */}
      {liveTranscript && (
        <div className="px-4 pb-2">
          <p className="text-white/50 text-sm italic text-center">{liveTranscript}</p>
        </div>
      )}

      {/* Bottom bar */}
      <div className="bg-white/10 backdrop-blur-md border-t border-white/20 p-4">
        <div className="flex items-center justify-center gap-6">
          {/* Pause tutor */}
          {(isPlaying || status === "speaking") && (
            <button
              onClick={stopAudio}
              className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
              aria-label="Pause tutor"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </button>
          )}

          {/* Mic toggle */}
          <button
            onClick={handleToggleMute}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? "bg-yellow-500 shadow-lg shadow-yellow-500/30 hover:bg-yellow-400"
                : "bg-green-500 shadow-lg shadow-green-500/30 scale-105 hover:bg-green-400"
            }`}
          >
            {isMuted ? (
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
          {isMuted ? "Microphone off" : "Listening..."}
        </p>
      </div>
    </div>
  );
}
