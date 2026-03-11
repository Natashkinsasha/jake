"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ChatMessage, VocabHighlight } from "@/types";
import { MatchingExercise } from "./MatchingExercise";

interface ChatHistoryProps {
  messages: ChatMessage[];
  isThinking: boolean;
  isTutorActive?: boolean;
  lessonId?: string | null;
  onVocabSaved?: (word: string) => void;
  onExerciseSubmit?: (exerciseId: string, answers: Array<{ word: string; definition: string }>) => void;
  activeExerciseId?: string;
}

function VocabCard({
  highlight,
  lessonId,
  onSaved,
  isSaved,
}: {
  highlight: VocabHighlight;
  lessonId?: string | null;
  onSaved?: (word: string) => void;
  isSaved: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(isSaved);

  const handleSave = useCallback(async () => {
    if (saved || saving) return;
    setSaving(true);
    try {
      await api.vocabulary.add({
        word: highlight.word,
        translation: highlight.translation,
        topic: highlight.topic,
        lessonId: lessonId ?? undefined,
      });
      setSaved(true);
      onSaved?.(highlight.word);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }, [highlight, lessonId, saved, saving, onSaved]);

  return (
    <div
      className={cn(
        "animate-fade-in inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all",
        saved
          ? "bg-emerald-50/90 border border-emerald-200/60"
          : "bg-white/80 backdrop-blur-sm border border-primary-200/60 hover:border-primary-300",
      )}
    >
      <span className="text-[13px] font-medium text-gray-900">{highlight.word}</span>
      <span className="text-[13px] text-gray-400">&mdash;</span>
      <span className="text-[13px] text-gray-500">{highlight.translation}</span>
      {saved ? (
        <svg
          className="size-3.5 shrink-0 text-emerald-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600 transition-colors hover:bg-primary-200 disabled:opacity-50"
          title="Add to vocabulary"
        >
          <svg className="size-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-1.5 p-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

export function ChatHistory({
  messages,
  isThinking,
  isTutorActive = false,
  lessonId,
  onVocabSaved,
  onExerciseSubmit,
  activeExerciseId,
}: ChatHistoryProps) {
  const savedWordsRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const lastAssistantIdx = messages.length - 1 - [...messages].reverse().findIndex((m) => m.role === "assistant");
  const isLastAssistantNew = lastAssistantIdx >= 0 && lastAssistantIdx === messages.length - 1;

  // Track whether user is scrolled near the bottom
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  // Only auto-scroll if user hasn't scrolled up to read old messages
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Keep scrolled to bottom during text reveal (only if user hasn't scrolled up)
  const _lastMessageText = messages[messages.length - 1]?.text;
  useEffect(() => {
    if (isNearBottomRef.current) {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, []);

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 space-y-3 overflow-y-auto px-4 pb-3">
      {messages.map((msg, i) => {
        // Skip the active exercise — it's rendered in ExercisePanel below the chat
        if (msg.role === "exercise" && msg.exercise?.exerciseId === activeExerciseId) {
          return null;
        }

        // Skip empty assistant messages stuck from interrupted streams
        // (the last empty one is OK — it shows loading dots for in-progress response)
        if (msg.role === "assistant" && !msg.text && i !== messages.length - 1) {
          return null;
        }

        return (
          <div key={`${msg.timestamp}-${msg.role}-${String(i)}`} className="animate-fade-in">
            {msg.role === "exercise" && msg.exercise ? (
              msg.exerciseFeedback ? (
                /* Completed exercise — show results */
                <MatchingExercise
                  exercise={msg.exercise}
                  feedback={msg.exerciseFeedback}
                  onSubmit={onExerciseSubmit ?? (() => {})}
                />
              ) : (
                /* Skipped exercise — compact placeholder */
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.05] px-4 py-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-5 items-center justify-center rounded-full bg-white/10">
                      <svg
                        className="size-3 text-white/30"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                        />
                      </svg>
                    </div>
                    <span className="text-sm text-white/30">Matching exercise</span>
                    <span className="ml-auto text-xs text-white/20">skipped</span>
                  </div>
                </div>
              )
            ) : msg.role === "user" ? (
              /* User message — right aligned */
              <div className="flex justify-end">
                <div className="gradient-bg max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
                  <p className="text-[15px] leading-relaxed text-white">{msg.text}</p>
                </div>
              </div>
            ) : msg.text ? (
              /* Tutor message — left aligned */
              <div className="space-y-2">
                <div className="flex justify-start">
                  <div
                    className={cn(
                      "bg-white/95 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[85%] shadow-sm",
                      i === lastAssistantIdx && isLastAssistantNew ? "" : "opacity-70",
                    )}
                  >
                    <p className="text-[15px] leading-relaxed text-gray-800">{msg.text}</p>
                  </div>
                </div>

                {/* Vocab cards inline */}
                {msg.vocabHighlights && msg.vocabHighlights.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {msg.vocabHighlights.map((h) => (
                      <VocabCard
                        key={h.word}
                        highlight={h}
                        lessonId={lessonId}
                        isSaved={savedWordsRef.current.has(h.word.toLowerCase())}
                        onSaved={(word) => {
                          savedWordsRef.current.add(word.toLowerCase());
                          onVocabSaved?.(word);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Last empty assistant message = loading dots */
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur-sm">
                  <ThinkingDots />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Thinking indicator — only when not already speaking */}
      {isThinking && !isTutorActive && (
        <div className="flex animate-fade-in justify-start">
          <div className="rounded-2xl rounded-bl-sm border border-white/[0.06] bg-white/[0.07] px-4 py-2.5 backdrop-blur-sm">
            <ThinkingDots />
          </div>
        </div>
      )}

      <div ref={scrollRef} />
    </div>
  );
}
