"use client";

import { cn } from "@/lib/utils";

interface ExerciseRendererProps {
  index: number;
  exercise: {
    type?: string;
    question?: string;
    sentence?: string;
    options?: string[];
    hint?: string;
  };
  value: string;
  onChange: (value: string) => void;
}

export function ExerciseRenderer({ index, exercise, value, onChange }: ExerciseRendererProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-primary-600 bg-primary-50 rounded-full px-2.5 py-0.5">
          {index + 1}
        </span>
        {exercise.type && (
          <span className="text-xs text-gray-400">
            {exercise.type.replace(/_/g, " ")}
          </span>
        )}
      </div>

      <p className="text-gray-900 font-medium mb-3">
        {exercise.question || exercise.sentence || "Complete the exercise"}
      </p>

      {exercise.hint && (
        <p className="text-xs text-gray-400 mb-3">Hint: {exercise.hint}</p>
      )}

      {exercise.options && exercise.options.length > 0 ? (
        <div className="space-y-2">
          {exercise.options.map((option, i) => (
            <button
              key={i}
              onClick={() => onChange(option)}
              className={cn(
                "w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all text-sm",
                value === option
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              )}
            >
              <span className="font-medium mr-2 text-gray-400">
                {String.fromCharCode(65 + i)}.
              </span>
              {option}
            </button>
          ))}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:border-primary-400 focus:ring-1 focus:ring-primary-400 outline-none text-sm"
          placeholder="Type your answer..."
        />
      )}
    </div>
  );
}
