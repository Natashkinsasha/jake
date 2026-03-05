"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ExerciseCard } from "./ExerciseCard";
import type { ChatMessage, LessonExercise } from "@/types";

interface ChatHistoryProps {
  messages: ChatMessage[];
  isThinking: boolean;
  currentExercise: LessonExercise | null;
  onSubmitExercise: (exerciseId: string, answer: string) => void;
}

export function ChatHistory({
  messages,
  isThinking,
  currentExercise,
  onSubmitExercise,
}: ChatHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAssistantIdx = messages.length - 1 - [...messages].reverse().findIndex((m) => m.role === "assistant");
  const isLastAssistantNew = lastAssistantIdx >= 0 && lastAssistantIdx === messages.length - 1;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, currentExercise]);

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
      {messages.map((msg, i) => (
        <div key={msg.timestamp}>
          {msg.role === "user" ? (
            <div className="flex justify-end">
              <p className="text-white/60 text-sm max-w-[85%] text-right">
                {msg.text}
              </p>
            </div>
          ) : (
            <p className={cn(
              "text-white text-[15px] leading-relaxed max-w-[85%]",
              i === lastAssistantIdx && isLastAssistantNew ? "" : "opacity-70",
            )}>
              {msg.text}
            </p>
          )}

          {msg.exercise && (
            <div className="mt-2">
              <ExerciseCard exercise={msg.exercise} onSubmit={onSubmitExercise} />
            </div>
          )}
        </div>
      ))}

      {isThinking && (
        <div className="flex gap-1.5 py-1">
          <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      )}

      {currentExercise &&
        !messages.some((m) => m.exercise && m.exercise.id === currentExercise.id) && (
          <ExerciseCard exercise={currentExercise} onSubmit={onSubmitExercise} />
        )}

      <div ref={scrollRef} />
    </div>
  );
}
