"use client";

import { useState, useRef, useCallback } from "react";
import { TutorAvatar } from "./TutorAvatar";
import { ListeningBar } from "./ListeningBar";
import { ChatHistory } from "./ChatHistory";
import { LessonSummary } from "./LessonSummary";
import { useLessonState } from "@/hooks/useLessonState";
import { useRouter } from "next/navigation";

type InputMode = "voice" | "text";

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
    lessonEnded: serverLessonEnded,
    startRecording,
    stopRecording,
    sendText,
    submitExerciseAnswer,
    endLesson,
  } = useLessonState();

  const [userEndedLesson, setUserEndedLesson] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("voice");
  const [textInput, setTextInput] = useState("");
  const textInputRef = useRef<HTMLInputElement>(null);
  const lessonEnded = userEndedLesson || serverLessonEnded;

  const hasReceivedFirstMessage = messages.some(
    (msg) => msg.role === "assistant",
  );

  const handleEndLesson = () => {
    endLesson();
    setUserEndedLesson(true);
  };

  const handleSendText = useCallback(() => {
    if (!textInput.trim()) return;
    sendText(textInput);
    setTextInput("");
    textInputRef.current?.focus();
  }, [textInput, sendText]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    },
    [handleSendText],
  );

  const toggleInputMode = useCallback(() => {
    setInputMode((prev) => (prev === "voice" ? "text" : "voice"));
  }, []);

  const isDisabled = status === "thinking" || status === "speaking";

  // -- Connection screen: WebSocket not yet connected --
  if (!connected) {
    return (
      <div className="min-h-screen lesson-gradient flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-14 h-14 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-5" />
          <p className="text-lg font-semibold">Connecting to your tutor...</p>
          <p className="text-sm text-white/60 mt-2">
            Setting up a secure connection
          </p>
        </div>
      </div>
    );
  }

  // -- Connected but waiting for first tutor message --
  if (connected && !hasReceivedFirstMessage && !lessonEnded) {
    return (
      <div className="min-h-screen lesson-gradient flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 mx-auto mb-5 relative">
            <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" />
            <div className="relative w-16 h-16 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
            </div>
          </div>
          <p className="text-lg font-semibold">Connected! Starting lesson...</p>
          <p className="text-sm text-white/60 mt-2">
            Jake is preparing your session
          </p>
        </div>
      </div>
    );
  }

  // -- Lesson ended --
  if (lessonEnded) {
    return (
      <LessonSummary
        lessonId={lessonId || ""}
        messageCount={messages.length}
        onClose={() => router.push("/dashboard")}
      />
    );
  }

  // -- Main lesson UI --
  return (
    <div className="min-h-screen lesson-gradient flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-safe">
        <button
          onClick={handleEndLesson}
          className="text-white/80 hover:text-white transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1 className="text-white font-semibold">Lesson with Jake</h1>
        <div className="w-6" />
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

      {/* Bottom bar: voice mode or text mode */}
      {inputMode === "voice" ? (
        <div className="relative">
          <ListeningBar
            isRecording={isRecording}
            isDisabled={isDisabled}
            status={isRecording ? "listening" : status}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onEndLesson={handleEndLesson}
          />
          {/* Toggle to text mode */}
          <button
            onClick={toggleInputMode}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-2"
            aria-label="Switch to text input"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25"
              />
            </svg>
          </button>
        </div>
      ) : (
        <div className="bg-white/10 backdrop-blur-md border-t border-white/20 p-4">
          <div className="flex items-center gap-3 max-w-lg mx-auto">
            {/* Toggle to voice mode */}
            <button
              onClick={toggleInputMode}
              className="text-white/60 hover:text-white transition-colors p-2 flex-shrink-0"
              aria-label="Switch to voice input"
            >
              <svg
                className="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>

            {/* Text input */}
            <input
              ref={textInputRef}
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isDisabled}
              placeholder={
                isDisabled ? "Jake is responding..." : "Type a message..."
              }
              className="flex-1 bg-white/20 text-white placeholder-white/50 rounded-full px-4 py-3 text-sm outline-none focus:bg-white/30 focus:ring-2 focus:ring-white/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {/* Send button */}
            <button
              onClick={handleSendText}
              disabled={isDisabled || !textInput.trim()}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-white/30 hover:bg-white/40 active:scale-95 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          </div>

          {/* End lesson link in text mode */}
          <div className="flex justify-center mt-2">
            <button
              onClick={handleEndLesson}
              className="text-white/50 hover:text-white text-xs font-medium transition-colors px-3 py-1"
            >
              End lesson
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
