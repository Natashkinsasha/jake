import { z } from "zod";
import { createZodDto } from "nestjs-zod";

const progressOverviewResponseSchema = z.object({
  currentLevel: z.string().nullable(),
  grammarTopics: z.array(
    z.object({
      topic: z.string(),
      level: z.number(),
      errorCount: z.number(),
    }),
  ),
  totalLessons: z.number(),
  totalWords: z.number(),
});

export class ProgressOverviewResponse extends createZodDto(progressOverviewResponseSchema) {}
