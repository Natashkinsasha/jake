import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const lessonSummaryResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationMinutes: z.number().nullable(),
  summary: z.string().nullable(),
  topics: z.array(z.string()),
  newWords: z.array(z.string()),
});

export class LessonSummaryResponse extends createZodDto(lessonSummaryResponseSchema) {}
