import { z } from "zod";

export const LessonStatusSchema = z.enum(["active", "completed", "cancelled"]);

export const ErrorFoundSchema = z.object({
  text: z.string(),
  correction: z.string(),
  topic: z.string(),
  explanation: z.string().optional(),
});

export const LessonSummarySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: LessonStatusSchema,
  startedAt: z.date(),
  endedAt: z.date().nullable(),
  durationMinutes: z.number().nullable(),
  summary: z.string().nullable(),
  topics: z.array(z.string()),
  newWords: z.array(z.string()),
  errorsFound: z.array(ErrorFoundSchema),
  levelAssessment: z.string().nullable(),
});

export type Lesson = z.infer<typeof LessonSummarySchema>;

export const PostLessonLlmResponseSchema = z.object({
  summary: z.string(),
  topics: z.array(z.string()),
  newWords: z.array(
    z.object({
      word: z.string(),
      translation: z.string(),
      topic: z.string(),
    }),
  ),
  reviewedWords: z.array(z.string()).default([]),
  errorsFound: z.array(ErrorFoundSchema),
  emotionalSummary: z.string().nullable(),
  levelAssessment: z.string().nullable(),
  suggestedNextTopics: z.array(z.string()),
});

export type PostLessonLlmResponse = z.infer<typeof PostLessonLlmResponseSchema>;
