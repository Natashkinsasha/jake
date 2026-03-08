"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMessage, VocabHighlight } from "@/types";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface ChatHistoryProps {
  messages: ChatMessage[];
  isThinking: boolean;
  isTutorActive?: boolean;
  lessonId?: string | null;
  onVocabSaved?: (word: string) => void;
}

function VocabCard({
  highlight,
  lessonId,
  onSaved,
}: {
  highlight: VocabHighlight;
  lessonId?: string | null;
  onSaved?: (word: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(highlight.saved ?? false);

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
        "animate-fade-in inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 shadow-sm transition-all",
        saved
          ? "bg-emerald-50/90 border border-emerald-200/60"
          : "bg-white/80 backdrop-blur-sm border border-primary-200/60 hover:border-primary-300",
      )}
    >
      <span className="text-[13px] font-medium text-gray-900">{highlight.word}</span>
      <span className="text-[13px] text-gray-400">&mdash;</span>
      <span className="text-[13px] text-gray-500">{highlight.translation}</span>
      {saved ? (
        <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-primary-100 hover:bg-primary-200 text-primary-600 transition-colors disabled:opacity-50"
          title="Add to vocabulary"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-1 py-1 px-1">
      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

export function ChatHistory({
  messages,
  isThinking,
  isTutorActive = false,
  lessonId,
  onVocabSaved,
}: ChatHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAssistantIdx = messages.length - 1 - [...messages].reverse().findIndex((m) => m.role === "assistant");
  const isLastAssistantNew = lastAssistantIdx >= 0 && lastAssistantIdx === messages.length - 1;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
      {/* eslint-disable-next-line @eslint-react/no-array-index-key -- timestamp alone may not be unique */}
      {messages.map((msg, i) => (
        <div key={`${msg.timestamp}-${i}`}>
          {msg.role === "user" ? (
            /* User message — right aligned, gradient bubble */
            <div className="flex justify-end">
              <div className="gradient-bg rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%] shadow-sm">
                <p className="text-white text-[15px] leading-relaxed">
                  {msg.text}
                </p>
              </div>
            </div>
          ) : msg.text ? (
            /* Tutor message — left aligned, white bubble */
            <div className="space-y-2">
              <div className="flex justify-start">
                <div className={cn(
                  "bg-white/95 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[80%] shadow-sm",
                  i === lastAssistantIdx && isLastAssistantNew ? "" : "opacity-80",
                )}>
                  <p className="text-gray-800 text-[15px] leading-relaxed">
                    {msg.text}
                  </p>
                </div>
              </div>

              {/* Vocab cards inline */}
              {msg.vocabHighlights && msg.vocabHighlights.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {msg.vocabHighlights.map((h, vi) => (
                    <VocabCard
                      key={`${h.word}-${vi}`}
                      highlight={h}
                      lessonId={lessonId}
                      onSaved={onVocabSaved}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Empty assistant message = loading */
            <div className="flex justify-start">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
                <ThinkingDots />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Thinking indicator */}
      {isThinking && (
        <div className="flex justify-start">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
            <ThinkingDots />
          </div>
        </div>
      )}

      {/* Tutor speaking indicator — inline at bottom of chat */}
      {isTutorActive && !isThinking && (
        <div className="flex items-center gap-2 py-1">
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-0.5 bg-white/50 rounded-full animate-wave"
                style={{
                  height: "12px",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
          <span className="text-white/40 text-xs">Jake is speaking</span>
        </div>
      )}

      <div ref={scrollRef} />
    </div>
  );
}
