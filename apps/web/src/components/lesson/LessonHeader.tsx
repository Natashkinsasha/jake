import { formatElapsed } from "@/lib/utils";

interface LessonHeaderProps {
  elapsed: number;
  onEndLesson: () => void;
  children?: React.ReactNode;
}

export function LessonHeader({ elapsed, onEndLesson, children }: LessonHeaderProps) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 pt-safe">
      <span className="text-white/70 text-sm font-mono tabular-nums tracking-wider">
        {formatElapsed(elapsed)}
      </span>
      <div className="flex items-center gap-3">
        {children}
        <button
          type="button"
          onClick={onEndLesson}
          className="text-white/50 hover:text-red-300 text-sm font-medium transition-colors"
        >
          End
        </button>
      </div>
    </div>
  );
}
