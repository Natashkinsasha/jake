import { z } from "zod";

export const TutorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  personality: z.string(),
  accent: z.string(),
  avatarUrl: z.string().nullable(),
  traits: z.array(z.string()),
  isActive: z.boolean(),
});

export type Tutor = z.infer<typeof TutorSchema>;
