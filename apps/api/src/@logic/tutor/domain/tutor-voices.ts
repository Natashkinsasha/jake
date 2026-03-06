import type { TutorGender, TutorVoice } from "./tutor-types";

export const TUTOR_VOICES: TutorVoice[] = [
  // Male voices
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", gender: "male" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", gender: "male" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", gender: "male" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "male" },
  // Female voices
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "female" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", gender: "female" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Emily", gender: "female" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", gender: "female" },
];

export function getVoicesByGender(gender: TutorGender): TutorVoice[] {
  return TUTOR_VOICES.filter((v) => v.gender === gender);
}

export function getDefaultVoice(gender: TutorGender): TutorVoice {
  const voice = TUTOR_VOICES.find((v) => v.gender === gender);
  if (!voice) throw new Error(`No voice found for gender: ${gender}`);
  return voice;
}
