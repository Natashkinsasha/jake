"use client";

import { useEffect, useRef } from "react";
import { ExerciseCard } from "./ExerciseCard";

interface Exercise {
  type: string;
  id: string;
  [key: string]: any;
}

interface Message {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  exercise?: Exercise | null;
}

interface ChatHistoryProps {
  messages: Message[];
  isThinking: boolean;
  currentExercise: Exercise | null;
  onSubmitExercise: (exerciseId: string, answer: string) => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatHistory({
  messages,
  isThinking,
  currentExercise,
  onSubmitExercise,
}: ChatHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, currentExercise]);

  return (
    <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
      {messages.map((msg, i) => (
        <div key={i}>
          <div
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-500 text-white rounded-br-md"
                  : "bg-white/20 text-white backdrop-blur-sm rounded-bl-md"
              }`}
            >
              <p className="text-sm leading-relaxed">{msg.text}</p>
              <p
                className={`text-[10px] mt-1 ${
                  msg.role === "user" ? "text-blue-100" : "text-white/50"
                }`}
              >
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>

          {/* Show inline exercise if the message has one attached */}
          {msg.exercise && (
            <div className="mt-2">
              <ExerciseCard
                exercise={msg.exercise}
                onSubmit={onSubmitExercise}
              />
            </div>
          )}
        </div>
      ))}

      {isThinking && (
        <div className="flex justify-start">
          <div className="bg-white/20 text-white backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-3">
            <div className="flex gap-1.5">
              <div
                className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Show the active exercise at the bottom if it's not already inline */}
      {currentExercise &&
        !messages.some(
          (m) => m.exercise && m.exercise.id === currentExercise.id,
        ) && (
          <ExerciseCard
            exercise={currentExercise}
            onSubmit={onSubmitExercise}
          />
        )}

      <div ref={scrollRef} />
    </div>
  );
}
