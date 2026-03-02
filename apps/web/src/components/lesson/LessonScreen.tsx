"use client";

import { TutorAvatar } from "./TutorAvatar";
import { ListeningBar } from "./ListeningBar";
import { ExerciseCard } from "./ExerciseCard";
import { useLessonState } from "@/hooks/useLessonState";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function LessonScreen() {
  const router = useRouter();
  const {
    lessonId,
    messages,
    currentExercise,
    status,
    connected,
    isRecording,
    isPlaying,
    startRecording,
    stopRecording,
    submitExerciseAnswer,
    endLesson,
  } = useLessonState();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleEndLesson = () => {
    endLesson();
    router.push("/dashboard");
  };

  if (!connected) {
    return (
      <div className="min-h-screen lesson-gradient flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Connecting to Jake...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lesson-gradient flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-safe">
        <button
          onClick={handleEndLesson}
          className="text-white/80 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white font-semibold">Lesson with Jake</h1>
        <div className="w-6" />
      </div>

      {/* Avatar area */}
      <div className="flex flex-col items-center py-6">
        <TutorAvatar isSpeaking={status === "speaking"} />
        <p className="text-white/80 text-sm mt-3 font-medium">Jake</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-white text-gray-900 rounded-br-md"
                  : "bg-white/20 text-white backdrop-blur-sm rounded-bl-md"
              }`}
            >
              <p className="text-sm leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}

        {status === "thinking" && (
          <div className="flex justify-start">
            <div className="bg-white/20 text-white backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {currentExercise && (
          <ExerciseCard exercise={currentExercise} onSubmit={submitExerciseAnswer} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom bar */}
      <ListeningBar
        isRecording={isRecording}
        isDisabled={status === "thinking" || status === "speaking"}
        status={isRecording ? "listening" : status}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onEndLesson={handleEndLesson}
      />
    </div>
  );
}
