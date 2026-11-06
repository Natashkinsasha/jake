export const EMOTIONS = [
  "neutral",
  "happy",
  "encouraging",
  "empathetic",
  "excited",
  "curious",
  "playful",
  "proud",
  "thoughtful",
  "surprised",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
}

const EMOTION_VOICE_MAP: Record<Emotion, VoiceSettings> = {
  neutral: { stability: 0.5, similarity_boost: 0.75, style: 0.0 },
  happy: { stability: 0.35, similarity_boost: 0.75, style: 0.6 },
  encouraging: { stability: 0.4, similarity_boost: 0.75, style: 0.5 },
  empathetic: { stability: 0.55, similarity_boost: 0.8, style: 0.3 },
  excited: { stability: 0.3, similarity_boost: 0.7, style: 0.8 },
  curious: { stability: 0.45, similarity_boost: 0.75, style: 0.4 },
  playful: { stability: 0.35, similarity_boost: 0.7, style: 0.7 },
  proud: { stability: 0.35, similarity_boost: 0.75, style: 0.65 },
  thoughtful: { stability: 0.55, similarity_boost: 0.8, style: 0.2 },
  surprised: { stability: 0.3, similarity_boost: 0.7, style: 0.7 },
};

const EMOTION_RE = /<emotion>(\w+)<\/emotion>/;

export function parseEmotion(text: string): { emotion: Emotion; text: string } {
  const match = EMOTION_RE.exec(text);
  if (!match) {
    return { emotion: "neutral", text: text.trim() };
  }

  const emotionName = match[1] as string;
  const cleanText = text.replace(EMOTION_RE, "").trim();

  return {
    emotion: resolveEmotion(emotionName),
    text: cleanText,
  };
}

// Other forms of listed words the model sometimes writes ("encouraged" for "encouraging")
const EMOTION_ALIASES: Record<string, Emotion> = {
  encouraged: "encouraging",
  encourage: "encouraging",
  empathic: "empathetic",
  empathy: "empathetic",
  excitement: "excited",
  exciting: "excited",
  curiosity: "curious",
  surprise: "surprised",
  pride: "proud",
  happiness: "happy",
};

function resolveEmotion(name: string): Emotion {
  if (EMOTIONS.includes(name as Emotion)) {
    return name as Emotion;
  }
  return EMOTION_ALIASES[name.toLowerCase()] ?? "neutral";
}

export function getVoiceSettingsForEmotion(emotion: Emotion): VoiceSettings {
  return EMOTION_VOICE_MAP[emotion] ?? EMOTION_VOICE_MAP.neutral;
}
