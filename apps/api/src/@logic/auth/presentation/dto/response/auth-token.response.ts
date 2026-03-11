import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const authTokenResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    currentLevel: z.string().nullable(),
  }),
});

export class AuthTokenResponse extends createZodDto(authTokenResponseSchema) {}
