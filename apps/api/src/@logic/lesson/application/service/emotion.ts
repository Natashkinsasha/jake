export const EMOTIONS = [
  "neutral", "happy", "encouraging", "empathetic", "excited",
  "curious", "playful", "proud", "thoughtful", "surprised",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
}

const EMOTION_VOICE_MAP: Record<Emotion, VoiceSettings> = {
  neutral: { stability: 0.5,  similarity_boost: 0.75, style: 0.0 },
  happy: { stability: 0.35, similarity_boost: 0.75, style: 0.6 },
  encouraging: { stability: 0.4,  similarity_boost: 0.75, style: 0.5 },
  empathetic: { stability: 0.55, similarity_boost: 0.8,  style: 0.3 },
  excited: { stability: 0.3,  similarity_boost: 0.7,  style: 0.8 },
  curious: { stability: 0.45, similarity_boost: 0.75, style: 0.4 },
  playful: { stability: 0.35, similarity_boost: 0.7,  style: 0.7 },
  proud: { stability: 0.35, similarity_boost: 0.75, style: 0.65 },
  thoughtful: { stability: 0.55, similarity_boost: 0.8,  style: 0.2 },
  surprised: { stability: 0.3,  similarity_boost: 0.7,  style: 0.7 },
};

const EMOTION_RE = /<emotion>(\w+)<\/emotion>/;

export function parseEmotion(text: string): { emotion: Emotion; text: string } {
  const match = EMOTION_RE.exec(text);
  if (!match) return { emotion: "neutral", text: text.trim() };

  const emotionName = match[1] as string;
  const isValid = EMOTIONS.includes(emotionName as Emotion);
  const cleanText = text.replace(EMOTION_RE, "").trim();

  return {
    emotion: isValid ? (emotionName as Emotion) : "neutral",
    text: cleanText,
  };
}

export function getVoiceSettingsForEmotion(emotion: Emotion): VoiceSettings {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- emotion may be an arbitrary string at runtime
  return EMOTION_VOICE_MAP[emotion] ?? EMOTION_VOICE_MAP.neutral;
}
