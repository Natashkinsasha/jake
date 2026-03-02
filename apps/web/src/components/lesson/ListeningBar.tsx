"use client";

import { VoiceWave } from "./VoiceWave";

interface ListeningBarProps {
  isRecording: boolean;
  isDisabled: boolean;
  status: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onEndLesson: () => void;
}

export function ListeningBar({
  isRecording,
  isDisabled,
  status,
  onStartRecording,
  onStopRecording,
  onEndLesson,
}: ListeningBarProps) {
  const statusLabels: Record<string, string> = {
    idle: "Tap to speak",
    connecting: "Connecting...",
    listening: "Listening...",
    thinking: "Jake is thinking...",
    speaking: "Jake is speaking...",
  };

  return (
    <div className="bg-white/10 backdrop-blur-md border-t border-white/20 p-4">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <button
          onClick={onEndLesson}
          className="text-white/70 hover:text-white text-sm font-medium transition-colors px-3 py-2"
        >
          End lesson
        </button>

        <div className="flex flex-col items-center gap-2">
          <button
            onMouseDown={onStartRecording}
            onMouseUp={onStopRecording}
            onTouchStart={onStartRecording}
            onTouchEnd={onStopRecording}
            disabled={isDisabled}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isRecording
                ? "bg-red-500 scale-110 shadow-lg shadow-red-500/30"
                : isDisabled
                  ? "bg-white/20 cursor-not-allowed"
                  : "bg-white/30 hover:bg-white/40 active:scale-95"
            }`}
          >
            {isRecording ? (
              <VoiceWave isActive={true} />
            ) : (
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
          </button>
          <span className="text-white/70 text-xs">{statusLabels[status] || status}</span>
        </div>

        <div className="w-[72px]" />
      </div>
    </div>
  );
}
