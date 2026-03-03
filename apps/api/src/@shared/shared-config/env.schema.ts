import { z } from "zod";

export const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_DB_NUMBER: z.coerce.number().default(0),

  // Bull Board
  BULL_BOARD_PATH: z.string().default("/admin/queues"),
  BULL_BOARD_USERNAME: z.string().default("admin"),
  BULL_BOARD_PASSWORD: z.string().default("admin"),
  BULL_BOARD_ENABLED: z.string().default("false"),

  // Auth
  JWT_SECRET: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  // Frontend
  FRONTEND_URL: z.string().default("http://localhost:3000"),

  // AI
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Voice
  DEEPGRAM_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;
