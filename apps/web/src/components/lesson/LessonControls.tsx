interface LessonControlsProps {
  isPaused: boolean;
  isMuted: boolean;
  onTogglePause: () => void;
  onToggleMute: () => void;
}

export function LessonControls({
  isPaused,
  isMuted,
  onTogglePause,
  onToggleMute,
}: LessonControlsProps) {
  return (
    <div className="flex-shrink-0 bg-white/10 backdrop-blur-md border-t border-white/20 p-4">
      <div className="flex items-center justify-center gap-6">
        {/* Pause/Resume */}
        <button
          type="button"
          onClick={onTogglePause}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isPaused
              ? "bg-green-500 hover:bg-green-400"
              : "bg-white/20 hover:bg-white/30"
          }`}
          aria-label={isPaused ? "Resume" : "Pause"}
        >
          {isPaused ? (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          )}
        </button>

        {/* Mic toggle */}
        <button
          type="button"
          onClick={onToggleMute}
          disabled={isPaused}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            isPaused
              ? "bg-gray-500 opacity-50"
              : isMuted
                ? "bg-yellow-500 shadow-lg shadow-yellow-500/30 hover:bg-yellow-400"
                : "bg-green-500 shadow-lg shadow-green-500/30 scale-105 hover:bg-green-400"
          }`}
        >
          {isMuted || isPaused ? (
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9l4.17 4.18L21 19.73 4.27 3z"/>
            </svg>
          ) : (
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
        </button>
      </div>
      <p className="text-white/50 text-xs text-center mt-2">
        {isPaused ? "Paused" : isMuted ? "Microphone off" : "Listening..."}
      </p>
    </div>
  );
}
