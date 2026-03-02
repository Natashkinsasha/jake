import { z } from "zod";

export const endLessonBodySchema = z.object({
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
});

export type EndLessonBody = z.infer<typeof endLessonBodySchema>;
