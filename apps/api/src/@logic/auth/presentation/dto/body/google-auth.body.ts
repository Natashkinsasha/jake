import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const googleAuthBodySchema = z.object({
  googleId: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().nullable(),
});

export class GoogleAuthBody extends createZodDto(googleAuthBodySchema) {}
