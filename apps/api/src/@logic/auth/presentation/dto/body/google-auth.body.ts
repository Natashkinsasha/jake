import { z } from "zod";

export const googleAuthBodySchema = z.object({
  googleId: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().nullable(),
});

export type GoogleAuthBody = z.infer<typeof googleAuthBodySchema>;
