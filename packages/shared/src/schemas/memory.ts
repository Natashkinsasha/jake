import { z } from "zod";

export const MemoryCategory = z.enum(["personal", "work", "hobby", "family", "travel", "education", "other"]);

export const EmotionalTone = z.enum(["happy", "excited", "neutral", "tired", "sad", "frustrated", "anxious"]);

export const FactExtractionResultSchema = z.object({
  facts: z.array(
    z.object({
      category: MemoryCategory,
      fact: z.string(),
      isTemporary: z.boolean(),
    }),
  ),
  errors: z.array(
    z.object({
      text: z.string(),
      correction: z.string(),
      topic: z.string(),
    }),
  ),
  mood: EmotionalTone,
  levelSignals: z.string().nullable(),
});

export type FactExtractionResult = z.infer<typeof FactExtractionResultSchema>;
