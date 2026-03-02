import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const submitHomeworkBodySchema = z.object({
  answers: z.record(z.string(), z.string()),
});

export class SubmitHomeworkBody extends createZodDto(submitHomeworkBodySchema) {}
