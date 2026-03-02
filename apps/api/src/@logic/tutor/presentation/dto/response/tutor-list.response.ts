import { z } from "zod";
import { createZodDto } from "nestjs-zod";

const tutorListResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  personality: z.string(),
  accent: z.string(),
  avatarUrl: z.string().nullable(),
  traits: z.array(z.string()),
});

export class TutorListResponse extends createZodDto(tutorListResponseSchema) {}
