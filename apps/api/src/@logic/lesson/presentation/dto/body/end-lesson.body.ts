import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const endLessonBodySchema = z.object({
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
});

export class EndLessonBody extends createZodDto(endLessonBodySchema) {}
