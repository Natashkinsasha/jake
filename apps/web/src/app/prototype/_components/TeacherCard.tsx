import { PersonaHeader } from "./PersonaHeader";

interface TeacherCardProps {
  visibleText: string;
  currentPhrase: string;
  isLoading: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  hasStarted: boolean;
  onStart: () => void;
  onNextPhrase: () => void;
}

export function TeacherCard({
  visibleText,
  currentPhrase,
  isLoading,
  isPlaying,
  isPaused,
  hasStarted,
  onStart,
  onNextPhrase,
}: TeacherCardProps) {
  const status = isLoading
    ? "Loading..."
    : isPlaying
      ? isPaused
        ? "Paused"
        : "Speaking..."
      : hasStarted
        ? "Ready"
        : "Press Play to start";

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <PersonaHeader
        letter="T"
        name="Teacher"
        status={status}
        accentColor="bg-blue-600"
      />

      <div className="min-h-[80px] bg-gray-800/50 rounded-xl p-4 mb-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span>Generating speech...</span>
          </div>
        ) : isPlaying || visibleText ? (
          <p className="text-xl leading-relaxed">
            <span className="text-white">{visibleText}</span>
            {isPlaying && !isPaused && (
              <span className="inline-block w-0.5 h-5 bg-blue-500 animate-pulse ml-0.5 align-text-bottom" />
            )}
          </p>
        ) : (
          <p className="text-gray-500 text-xl leading-relaxed">
            {currentPhrase}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        {!hasStarted && (
          <button
            onClick={onStart}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 transition-colors font-medium"
          >
            Play
          </button>
        )}
        <button
          onClick={onNextPhrase}
          disabled={isLoading}
          className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Next phrase
        </button>
      </div>
    </div>
  );
}
