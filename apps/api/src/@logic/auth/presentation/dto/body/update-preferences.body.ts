import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const updatePreferencesBodySchema = z.object({
  correctionStyle: z.string().optional(),
  explainGrammar: z.boolean().optional(),
  speakingSpeed: z.string().optional(),
  useNativeLanguage: z.boolean().optional(),
  preferredExerciseTypes: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  ttsModel: z.string().optional(),
  tutorGender: z.enum(["male", "female"]).optional(),
  tutorNationality: z.enum(["australian", "british", "scottish", "american"]).optional(),
  tutorVoiceId: z.string().optional(),
});

export class UpdatePreferencesBody extends createZodDto(updatePreferencesBodySchema) {}
