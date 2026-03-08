"use client";

import { MatchingExercise } from "./MatchingExercise";
import type { ExerciseData } from "@/types";

interface ExercisePanelProps {
  exercise: ExerciseData;
  onSubmit: (exerciseId: string, answers: Array<{ word: string; definition: string }>) => void;
  onDismiss: () => void;
}

export function ExercisePanel({ exercise, onSubmit, onDismiss }: ExercisePanelProps) {
  return (
    <div className="flex-shrink-0 overflow-y-auto animate-slide-up" style={{ maxHeight: "45vh" }}>
      <div className="relative mx-3 mb-2 p-4 rounded-2xl bg-white/[0.05] backdrop-blur-sm border border-white/[0.08]">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center rounded-full text-white/20 hover:text-white/50 hover:bg-white/10 transition-colors"
          aria-label="Dismiss exercise"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <MatchingExercise
          exercise={exercise}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}
