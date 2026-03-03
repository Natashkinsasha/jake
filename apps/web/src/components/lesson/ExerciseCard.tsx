"use client";

import { FillTheGap } from "./FillTheGap";
import { MultipleChoice } from "./MultipleChoice";
import { SentenceBuilder } from "./SentenceBuilder";
import { ErrorCorrection } from "./ErrorCorrection";
import type { LessonExercise } from "@/types";

interface ExerciseCardProps {
  exercise: LessonExercise;
  onSubmit: (exerciseId: string, answer: string) => void;
}

function renderExercise(exercise: LessonExercise, onSubmit: (answer: string) => void) {
  switch (exercise.type) {
    case "fill_the_gap":
      return <FillTheGap exercise={exercise} onSubmit={onSubmit} />;
    case "multiple_choice":
      return <MultipleChoice exercise={exercise} onSubmit={onSubmit} />;
    case "sentence_builder":
      return <SentenceBuilder exercise={exercise} onSubmit={onSubmit} />;
    case "error_correction":
      return <ErrorCorrection exercise={exercise} onSubmit={onSubmit} />;
  }
}

export function ExerciseCard({ exercise, onSubmit }: ExerciseCardProps) {
  const handleSubmit = (answer: string) => {
    onSubmit(exercise.id, answer);
  };

  return (
    <div className="mx-4 my-2 bg-white rounded-2xl shadow-lg p-5 border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-primary-600 bg-primary-50 rounded-full px-3 py-1">
          Exercise
        </span>
      </div>
      {renderExercise(exercise, handleSubmit)}
    </div>
  );
}
