import { z } from "zod";
import { createZodDto } from "nestjs-zod";

const updatePreferencesBodySchema = z.object({
  correctionStyle: z.string().optional(),
  explainGrammar: z.boolean().optional(),
  speakingSpeed: z.string().optional(),
  useNativeLanguage: z.boolean().optional(),
  preferredExerciseTypes: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  ttsModel: z.string().optional(),
});

export class UpdatePreferencesBody extends createZodDto(updatePreferencesBodySchema) {}
