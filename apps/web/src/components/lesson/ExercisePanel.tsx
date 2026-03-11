"use client";

import type { ExerciseData } from "@/types";
import { MatchingExercise } from "./MatchingExercise";

interface ExercisePanelProps {
  exercise: ExerciseData;
  onSubmit: (exerciseId: string, answers: Array<{ word: string; definition: string }>) => void;
  onDismiss: () => void;
}

export function ExercisePanel({ exercise, onSubmit, onDismiss }: ExercisePanelProps) {
  return (
    <div className="shrink-0 animate-slide-up overflow-y-auto" style={{ maxHeight: "45vh" }}>
      <div className="relative mx-3 mb-2 rounded-2xl border border-white/[0.08] bg-white/[0.05] p-4 backdrop-blur-sm">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full text-white/20 transition-colors hover:bg-white/10 hover:text-white/50"
          aria-label="Dismiss exercise"
        >
          <svg
            className="size-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <MatchingExercise exercise={exercise} onSubmit={onSubmit} />
      </div>
    </div>
  );
}
