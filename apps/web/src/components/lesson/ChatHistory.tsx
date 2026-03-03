"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ExerciseCard } from "./ExerciseCard";
import { CHAT_CONFIG } from "@/lib/config";
import type { ChatMessage, LessonExercise } from "@/types";

interface ChatHistoryProps {
  messages: ChatMessage[];
  isThinking: boolean;
  isSpeaking: boolean;
  currentExercise: LessonExercise | null;
  onSubmitExercise: (exerciseId: string, answer: string) => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const { WORDS_PER_TICK, TICK_MS } = CHAT_CONFIG;

function StreamingText({ text, isActive }: { text: string; isActive: boolean }) {
  const words = text.split(" ");
  const [count, setCount] = useState<number>(WORDS_PER_TICK);
  const wasActiveRef = useRef(false);
  const [frozen, setFrozen] = useState(false);

  if (isActive) wasActiveRef.current = true;

  useEffect(() => {
    if (wasActiveRef.current && !isActive && count < words.length) {
      setFrozen(true);
    }
  }, [isActive, count, words.length]);

  useEffect(() => {
    if (frozen || !isActive || count >= words.length) return;
    const timer = setTimeout(() => setCount((c) => Math.min(c + WORDS_PER_TICK, words.length)), TICK_MS);
    return () => clearTimeout(timer);
  }, [count, words.length, frozen, isActive]);

  if (!wasActiveRef.current) return <>{text}</>;
  if (frozen) return <>{words.slice(0, count).join(" ")}...</>;
  return <>{words.slice(0, count).join(" ")}</>;
}

export function ChatHistory({
  messages,
  isThinking,
  isSpeaking,
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
    <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
      {messages.map((msg, i) => {
        return (
          <div key={i}>
            <div
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3",
                  msg.role === "user"
                    ? "bg-blue-500 text-white rounded-br-md"
                    : "bg-white/20 text-white backdrop-blur-sm rounded-bl-md"
                )}
              >
                <p className="text-sm leading-relaxed">
                  {msg.role === "assistant" && i === lastAssistantIdx && isLastAssistantNew ? (
                    <StreamingText text={msg.text} isActive={isSpeaking} />
                  ) : (
                    msg.text
                  )}
                </p>
                <p
                  className={cn(
                    "text-[10px] mt-1",
                    msg.role === "user" ? "text-blue-100" : "text-white/50"
                  )}
                >
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>

            {msg.exercise && (
              <div className="mt-2">
                <ExerciseCard
                  exercise={msg.exercise}
                  onSubmit={onSubmitExercise}
                />
              </div>
            )}
          </div>
        );
      })}

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
