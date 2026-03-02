"use client";

import { useState } from "react";

interface FillTheGapProps {
  exercise: {
    sentence: string;
    hint?: string;
  };
  onSubmit: (answer: string) => void;
}

export function FillTheGap({ exercise, onSubmit }: FillTheGapProps) {
  const [answer, setAnswer] = useState("");

  const parts = exercise.sentence.split("___");

  return (
    <div>
      <p className="text-gray-700 mb-3">Fill in the blank:</p>
      <p className="text-lg font-medium text-gray-900 mb-4">
        {parts[0]}
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="inline-block mx-1 px-3 py-1 border-b-2 border-primary-400 bg-primary-50 rounded-t text-primary-700 font-semibold outline-none focus:border-primary-600 w-32 text-center"
          placeholder="..."
          autoFocus
        />
        {parts[1]}
      </p>
      {exercise.hint && (
        <p className="text-sm text-gray-400 mb-3">Hint: {exercise.hint}</p>
      )}
      <button
        onClick={() => answer.trim() && onSubmit(answer.trim())}
        disabled={!answer.trim()}
        className="btn-primary w-full"
      >
        Check
      </button>
    </div>
  );
}
