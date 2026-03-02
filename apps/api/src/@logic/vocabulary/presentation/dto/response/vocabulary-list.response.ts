import { z } from "zod";
import { createZodDto } from "nestjs-zod";

const vocabularyListResponseSchema = z.object({
  words: z.array(
    z.object({
      id: z.string().uuid(),
      word: z.string(),
      strength: z.number(),
      nextReview: z.string().nullable(),
    }),
  ),
});

export class VocabularyListResponse extends createZodDto(vocabularyListResponseSchema) {}
