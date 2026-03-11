import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const sttMetricsBodySchema = z.object({
  durationMs: z.number().int().nonnegative(),
  transcriptLength: z.number().int().nonnegative(),
  segments: z.number().int().nonnegative(),
});

export class SttMetricsBody extends createZodDto(sttMetricsBodySchema) {}
