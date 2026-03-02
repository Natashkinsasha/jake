import { PersonaHeader } from "./PersonaHeader";
import { cn } from "@/lib/utils";

interface StudentCardProps {
  finalText: string;
  isEnabled: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isSupported: boolean;
  error: string | null;
  onToggleMic: () => void;
}

export function StudentCard({
  finalText,
  isEnabled,
  isListening,
  isProcessing,
  isSupported,
  error,
  onToggleMic,
}: StudentCardProps) {
  const status = !isEnabled
    ? "Mic off"
    : isListening
      ? "Listening..."
      : isProcessing
        ? "Transcribing..."
        : "Ready";

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <PersonaHeader
        letter="S"
        name="Student"
        status={status}
        accentColor="bg-emerald-600"
      />

      <div className="min-h-[80px] bg-gray-800/50 rounded-xl p-4 mb-4">
        {finalText ? (
          <p className="text-xl leading-relaxed">
            <span className="text-white">{finalText}</span>
          </p>
        ) : (
          <p className="text-gray-600 text-lg">
            {isListening
              ? "Speak now..."
              : isProcessing
                ? "Transcribing..."
                : "Your transcription will appear here"}
          </p>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {!isSupported ? (
        <p className="text-center text-amber-400 text-sm py-3">
          Microphone access is not supported in this browser.
        </p>
      ) : (
        <button
          onClick={onToggleMic}
          className={cn(
            "w-full py-4 rounded-xl font-medium transition-all select-none",
            isEnabled
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-gray-700 hover:bg-gray-600",
          )}
        >
          {isEnabled ? "🎤 Mic on" : "🎤 Mic off"}
        </button>
      )}
    </div>
  );
}
