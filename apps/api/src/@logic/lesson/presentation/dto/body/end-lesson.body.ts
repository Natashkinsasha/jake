import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const endLessonBodySchema = z.object({
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
});

export class EndLessonBody extends createZodDto(endLessonBodySchema) {}
