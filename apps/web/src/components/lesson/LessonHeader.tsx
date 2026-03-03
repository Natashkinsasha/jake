import { formatElapsed } from "@/lib/utils";

interface LessonHeaderProps {
  elapsed: number;
  onEndLesson: () => void;
}

export function LessonHeader({ elapsed, onEndLesson }: LessonHeaderProps) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between p-4 pt-safe">
      <span className="text-white/80 text-lg font-mono w-20">{formatElapsed(elapsed)}</span>
      <h1 className="text-white font-semibold">Lesson with Jake</h1>
      <button
        type="button"
        onClick={onEndLesson}
        className="bg-red-500/80 hover:bg-red-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
      >
        End lesson
      </button>
    </div>
  );
}
