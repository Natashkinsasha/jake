import { formatElapsed } from "@/lib/utils";

interface LessonControlsProps {
  isPaused: boolean;
  isMuted: boolean;
  sttError: string | null;
  elapsed: number;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onEndLesson: () => void;
}

export function LessonControls({
  isPaused,
  isMuted,
  sttError,
  elapsed,
  onTogglePause,
  onToggleMute,
  onEndLesson,
}: LessonControlsProps) {
  return (
    <div className="pb-safe-extra shrink-0">
      {/* Frosted glass background */}
      <div className="border-t border-white/[0.06] bg-white/[0.04] px-5 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          {/* Timer — left side */}
          <div className="flex w-20 items-center gap-1.5">
            <div className="size-1.5 animate-pulse-slow rounded-full bg-emerald-400/60" />
            <span className="font-mono text-xs tabular-nums tracking-wider text-white/50">
              {formatElapsed(elapsed)}
            </span>
          </div>

          {/* Center — mic controls */}
          <div className="flex items-center gap-4">
            {/* Pause/Resume */}
            <button
              type="button"
              onClick={onTogglePause}
              className={`flex size-10 items-center justify-center rounded-full transition-all duration-300 ${
                isPaused
                  ? "border border-white/20 bg-white/15 hover:bg-white/25"
                  : "border border-white/[0.08] bg-white/[0.06] hover:bg-white/10"
              }`}
              aria-label={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? (
                <svg className="size-4 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="size-4 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              )}
            </button>

            {/* Mic toggle — primary button */}
            <button
              type="button"
              onClick={onToggleMute}
              disabled={isPaused}
              className="group relative"
              aria-label={sttError ? "Retry microphone" : isMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {/* Glow ring when listening */}
              {!isMuted && !isPaused && !sttError && (
                <div className="absolute inset-[-6px] animate-glow-pulse rounded-full" />
              )}
              <div
                className={`relative flex size-14 items-center justify-center rounded-full transition-all duration-300 ${
                  isPaused
                    ? "border border-white/[0.08] bg-white/[0.06] opacity-40"
                    : sttError
                      ? "border border-amber-400/30 bg-amber-500/20"
                      : isMuted
                        ? "border border-red-400/30 bg-red-500/20"
                        : "border border-indigo-400/30 bg-indigo-500/20"
                }`}
              >
                {isPaused ? (
                  <svg className="size-6 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9l4.17 4.18L21 19.73 4.27 3z" />
                  </svg>
                ) : sttError ? (
                  <svg
                    className="size-6 text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                ) : isMuted ? (
                  <svg className="size-6 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9l4.17 4.18L21 19.73 4.27 3z" />
                  </svg>
                ) : (
                  <svg className="size-6 text-indigo-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                )}
              </div>
            </button>
          </div>

          {/* End button — right side */}
          <div className="flex w-20 justify-end">
            <button
              type="button"
              onClick={onEndLesson}
              className="rounded-lg px-3 py-1.5 text-xs font-medium tracking-wide text-white/40 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400/80"
            >
              End
            </button>
          </div>
        </div>

        {/* Status text */}
        <p className="mt-2 text-center text-[11px] tracking-wide text-white/40">
          {isPaused ? "Paused" : sttError ? "Mic error — tap to retry" : isMuted ? "Muted" : "Listening"}
        </p>
      </div>
    </div>
  );
}
