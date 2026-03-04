"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ExerciseCard } from "./ExerciseCard";
import type { ChatMessage, LessonExercise } from "@/types";

interface ChatHistoryProps {
  messages: ChatMessage[];
  isThinking: boolean;
  isSpeaking: boolean;
  currentExercise: LessonExercise | null;
  onSubmitExercise: (exerciseId: string, answer: string) => void;
  onRevealedWords?: (count: number) => void;
}

const TICK_MS = 300;

function StreamingText({
  text,
  isActive,
  onRevealedWords,
}: {
  text: string;
  isActive: boolean;
  onRevealedWords?: (count: number) => void;
}) {
  const words = text.split(" ");
  const [count, setCount] = useState(1);
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
    const timer = setTimeout(() => { setCount((c) => Math.min(c + 1, words.length)); }, TICK_MS);
    return () => { clearTimeout(timer); };
  }, [count, words.length, frozen, isActive]);

  useEffect(() => {
    onRevealedWords?.(count);
  }, [count, onRevealedWords]);

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
  onRevealedWords,
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
              {i === lastAssistantIdx && isLastAssistantNew ? (
                <StreamingText text={msg.text} isActive={isSpeaking} onRevealedWords={onRevealedWords} />
              ) : (
                msg.text
              )}
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
