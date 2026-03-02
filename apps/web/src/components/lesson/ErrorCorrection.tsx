"use client";

import { useState } from "react";

interface ErrorCorrectionProps {
  exercise: {
    sentence: string;
    hint?: string;
  };
  onSubmit: (answer: string) => void;
}

export function ErrorCorrection({ exercise, onSubmit }: ErrorCorrectionProps) {
  const [corrected, setCorrected] = useState(exercise.sentence);

  return (
    <div>
      <p className="text-gray-700 mb-3">Find and fix the error:</p>
      {exercise.hint && (
        <p className="text-sm text-gray-400 mb-3">Hint: {exercise.hint}</p>
      )}
      <textarea
        value={corrected}
        onChange={(e) => setCorrected(e.target.value)}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 font-medium focus:border-primary-400 outline-none resize-none"
        rows={2}
      />
      <button
        onClick={() => corrected.trim() && onSubmit(corrected.trim())}
        disabled={corrected.trim() === exercise.sentence}
        className="btn-primary w-full mt-3"
      >
        Check
      </button>
    </div>
  );
}
