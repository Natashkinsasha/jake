import { z } from "zod";

export const wsExerciseAnswerSchema = z.object({
  exerciseId: z.string(),
  answer: z.string(),
});

export interface WsExerciseAnswer {
  exerciseId: string;
  answer: string;
}
