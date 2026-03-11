// API & WebSocket URLs
export const API_URL =
  process.env["NEXT_PUBLIC_API_URL"] ?? (typeof window !== "undefined" ? "/api" : "http://localhost:4000");

function resolveWsUrl(): string {
  if (process.env["NEXT_PUBLIC_WS_URL"]) {
    return process.env["NEXT_PUBLIC_WS_URL"];
  }
  if (typeof window === "undefined") {
    return "http://localhost:4000/ws/lesson";
  }
  // Dev: connect directly to API on port 4000 (Next.js rewrites don't support WebSocket)
  // Prod: same origin via nginx proxy
  const { protocol, hostname, port } = window.location;
  const isLocalDev = hostname === "localhost" && port === "3000";
  if (isLocalDev) {
    return "http://localhost:4000/ws/lesson";
  }
  const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${hostname}/ws/lesson`;
}

export const WS_URL = resolveWsUrl();

// STT (Deepgram)
export const STT_CONFIG = {
  WS_URL: "wss://api.deepgram.com/v1/listen",
  MODEL: "nova-3",
  LANGUAGE: "en",
  SMART_FORMAT: true,
  INTERIM_RESULTS: true,
  ENDPOINTING_MS: 200,
  VAD_EVENTS: true,
} as const;

// Lesson
export const LESSON_CONFIG = {
  SILENCE_MS: 500,
} as const;

// Chat streaming
export const CHAT_CONFIG = {
  WORDS_PER_TICK: 1,
  TICK_MS: 150,
} as const;

// Toast
export const TOAST_CONFIG = {
  DURATION_MS: 4000,
} as const;

// TTS (ElevenLabs)
export const TTS_CONFIG = {
  MODEL: "eleven_turbo_v2_5",
  OUTPUT_FORMAT: "pcm_24000",
  SAMPLE_RATE: 24_000,
  VOICE_SETTINGS: { stability: 0.65, similarity_boost: 0.75, style: 0.4 },
  CHUNK_LENGTH_SCHEDULE: [120, 160, 250],
  CROSSFADE_MS: 5,
  PRE_BUFFER_MS: 150,
} as const;

// Emotion → ElevenLabs voice_settings map
export const EMOTION_VOICE_SETTINGS: Record<string, { stability: number; similarity_boost: number; style: number }> = {
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
