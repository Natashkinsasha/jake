import { z } from "zod";

export const ExerciseType = z.enum([
  "fill_the_gap",
  "multiple_choice",
  "sentence_builder",
  "error_correction",
  "translation",
  "matching",
  "listening",
  "free_response",
]);

export const ExerciseSchema = z.object({
  id: z.string(),
  type: ExerciseType,
  instruction: z.string(),
  content: z.record(z.unknown()),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  hints: z.array(z.string()).optional(),
  topic: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export const HomeworkSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  lessonId: z.string().uuid(),
  exercises: z.array(ExerciseSchema),
  createdAt: z.date(),
  dueAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  score: z.number().nullable(),
});

export type Exercise = z.infer<typeof ExerciseSchema>;
export type Homework = z.infer<typeof HomeworkSchema>;
