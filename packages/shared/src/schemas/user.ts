import { z } from "zod";

export const CefrLevel = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);

export const CorrectionStyle = z.enum(["immediate", "end_of_lesson", "natural"]);
export const SpeakingSpeed = z.enum(["slow", "natural", "fast"]);

export const UserPreferencesSchema = z.object({
  correctionStyle: CorrectionStyle.default("immediate"),
  explainGrammar: z.boolean().default(true),
  speakingSpeed: SpeakingSpeed.default("natural"),
  useNativeLanguage: z.boolean().default(false),
  preferredExerciseTypes: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  googleId: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().nullable(),
  nativeLanguage: z.string().default("ru"),
  currentLevel: CefrLevel.nullable(),
  preferences: UserPreferencesSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type CefrLevelType = z.infer<typeof CefrLevel>;
