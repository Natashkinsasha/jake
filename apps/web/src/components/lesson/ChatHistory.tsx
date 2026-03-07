"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

interface ChatHistoryProps {
  messages: ChatMessage[];
  isThinking: boolean;
  isTutorActive?: boolean;
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
}: ChatHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAssistantIdx = messages.length - 1 - [...messages].reverse().findIndex((m) => m.role === "assistant");
  const isLastAssistantNew = lastAssistantIdx >= 0 && lastAssistantIdx === messages.length - 1;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
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
                    <div
                      key={`${h.word}-${vi}`}
                      className="animate-fade-in inline-flex items-center gap-1.5 bg-white/80 backdrop-blur-sm border border-primary-200/60 rounded-lg px-2.5 py-1.5 shadow-sm"
                    >
                      <div className="w-1 h-1 rounded-full bg-primary-400 flex-shrink-0" />
                      <span className="text-[13px] font-medium text-gray-900">{h.word}</span>
                      <span className="text-[13px] text-gray-400">&mdash;</span>
                      <span className="text-[13px] text-gray-500">{h.translation}</span>
                    </div>
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
