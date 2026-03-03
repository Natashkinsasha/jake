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
      {exercise.type === "fill_the_gap" && exercise.sentence && (
        <FillTheGap exercise={{ sentence: exercise.sentence, hint: exercise.hint }} onSubmit={handleSubmit} />
      )}
      {exercise.type === "multiple_choice" && exercise.question && exercise.options && (
        <MultipleChoice exercise={{ question: exercise.question, options: exercise.options }} onSubmit={handleSubmit} />
      )}
      {exercise.type === "sentence_builder" && exercise.words && (
        <SentenceBuilder exercise={{ words: exercise.words, hint: exercise.hint }} onSubmit={handleSubmit} />
      )}
      {exercise.type === "error_correction" && exercise.sentence && (
        <ErrorCorrection exercise={{ sentence: exercise.sentence, hint: exercise.hint }} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
