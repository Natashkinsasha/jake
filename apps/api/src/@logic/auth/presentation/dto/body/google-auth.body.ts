import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const googleAuthBodySchema = z.object({
  googleId: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().nullable(),
});

export class GoogleAuthBody extends createZodDto(googleAuthBodySchema) {}
