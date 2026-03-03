"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ExerciseSubmitButton } from "./ExerciseSubmitButton";
import type { MultipleChoiceExercise } from "@/types";

interface MultipleChoiceProps {
  exercise: MultipleChoiceExercise;
  onSubmit: (answer: string) => void;
}

export function MultipleChoice({ exercise, onSubmit }: MultipleChoiceProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <p className="text-gray-700 mb-4">{exercise.question}</p>
      <div className="space-y-2 mb-4">
        {exercise.options.map((option, i) => (
          <button
            key={i}
            onClick={() => { setSelected(option); }}
            className={cn(
              "w-full text-left px-4 py-3 rounded-xl border-2 transition-all",
              selected === option
                ? "border-primary-500 bg-primary-50 text-primary-700"
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            )}
          >
            <span className="font-medium mr-2 text-gray-400">{String.fromCharCode(65 + i)}.</span>
            {option}
          </button>
        ))}
      </div>
      <ExerciseSubmitButton
        disabled={!selected}
        onClick={() => { if (selected) onSubmit(selected); }}
      />
    </div>
  );
}
