"use client";

import { useState } from "react";
import { ExerciseHint } from "./ExerciseHint";
import { ExerciseSubmitButton } from "./ExerciseSubmitButton";
import type { ErrorCorrectionExercise } from "@/types";

interface ErrorCorrectionProps {
  exercise: ErrorCorrectionExercise;
  onSubmit: (answer: string) => void;
}

export function ErrorCorrection({ exercise, onSubmit }: ErrorCorrectionProps) {
  const [corrected, setCorrected] = useState(exercise.sentence);

  return (
    <div>
      <p className="text-gray-700 mb-3">Find and fix the error:</p>
      <ExerciseHint hint={exercise.hint} />
      <textarea
        value={corrected}
        onChange={(e) => setCorrected(e.target.value)}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 font-medium focus:border-primary-400 outline-none resize-none"
        rows={2}
      />
      <ExerciseSubmitButton
        disabled={corrected.trim() === exercise.sentence}
        onClick={() => corrected.trim() && onSubmit(corrected.trim())}
        className="mt-3"
      />
    </div>
  );
}
