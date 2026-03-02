"use client";

import { FillTheGap } from "./FillTheGap";
import { MultipleChoice } from "./MultipleChoice";
import { SentenceBuilder } from "./SentenceBuilder";
import { ErrorCorrection } from "./ErrorCorrection";

interface ExerciseCardProps {
  exercise: {
    type: string;
    id: string;
    [key: string]: any;
  };
  onSubmit: (exerciseId: string, answer: string) => void;
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
      {exercise.type === "fill_the_gap" && (
        <FillTheGap exercise={exercise as any} onSubmit={handleSubmit} />
      )}
      {exercise.type === "multiple_choice" && (
        <MultipleChoice exercise={exercise as any} onSubmit={handleSubmit} />
      )}
      {exercise.type === "sentence_builder" && (
        <SentenceBuilder exercise={exercise as any} onSubmit={handleSubmit} />
      )}
      {exercise.type === "error_correction" && (
        <ErrorCorrection exercise={exercise as any} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
