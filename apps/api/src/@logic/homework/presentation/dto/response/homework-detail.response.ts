import { z } from "zod";
import { createZodDto } from "nestjs-zod";

const homeworkDetailResponseSchema = z.object({
  id: z.string().uuid(),
  lessonId: z.string().uuid(),
  exercises: z.array(z.record(z.unknown())),
  createdAt: z.string(),
  dueAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  score: z.number().nullable(),
});

export class HomeworkDetailResponse extends createZodDto(homeworkDetailResponseSchema) {}
