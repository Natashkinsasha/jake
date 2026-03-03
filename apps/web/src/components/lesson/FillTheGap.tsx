"use client";

import { useState } from "react";
import { ExerciseHint } from "./ExerciseHint";
import { ExerciseSubmitButton } from "./ExerciseSubmitButton";
import type { FillTheGapExercise } from "@/types";

interface FillTheGapProps {
  exercise: FillTheGapExercise;
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
          onChange={(e) => { setAnswer(e.target.value); }}
          className="inline-block mx-1 px-3 py-1 border-b-2 border-primary-400 bg-primary-50 rounded-t text-primary-700 font-semibold outline-none focus:border-primary-600 w-32 text-center"
          placeholder="..."
          autoFocus
        />
        {parts[1]}
      </p>
      <ExerciseHint hint={exercise.hint} />
      <ExerciseSubmitButton
        disabled={!answer.trim()}
        onClick={() => { if (answer.trim()) onSubmit(answer.trim()); }}
      />
    </div>
  );
}
