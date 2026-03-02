import { z } from "zod";

export const submitHomeworkBodySchema = z.object({
  answers: z.record(z.string(), z.string()),
});

export type SubmitHomeworkBody = z.infer<typeof submitHomeworkBodySchema>;
