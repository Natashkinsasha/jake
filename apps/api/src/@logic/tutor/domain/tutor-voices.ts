/* eslint-disable no-secrets/no-secrets -- ElevenLabs public voice IDs and preview URLs, not secrets */
import type { TutorGender, TutorVoice } from "./tutor-types";

export const TUTOR_VOICES: TutorVoice[] = [
  // Male voices
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", gender: "male", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/d6905d7a-dd26-4187-bfff-1bd3a5ea7cac.mp3" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", gender: "male", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/IKne3meq5aSn9XLyUdCD/102de6f2-22ed-43e0-a1f1-111fa75c5481.mp3" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "male", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/onwK4e9ZLuTAKqWW03F9/7eee0236-1a72-4b86-b303-5dcadc007ba9.mp3" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "male", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3" },
  // Female voices
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", gender: "female", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", gender: "female", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "female", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/pFZP5JQG7iQjIQuC4Bku/89b68b35-b3dd-4348-a84a-a3c13a3c2b30.mp3" },
];

export function getVoicesByGender(gender: TutorGender): TutorVoice[] {
  return TUTOR_VOICES.filter((v) => v.gender === gender);
}

export function getDefaultVoice(gender: TutorGender): TutorVoice {
  const voice = TUTOR_VOICES.find((v) => v.gender === gender);
  if (!voice) throw new Error(`No voice found for gender: ${gender}`);
  return voice;
}
