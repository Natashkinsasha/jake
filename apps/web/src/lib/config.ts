// API & WebSocket URLs
export const API_URL =
  process.env["NEXT_PUBLIC_API_URL"] ??
  (typeof window !== "undefined" ? "/api" : "http://localhost:4000");

function resolveWsUrl(): string {
  if (process.env["NEXT_PUBLIC_WS_URL"]) return process.env["NEXT_PUBLIC_WS_URL"];
  if (typeof window === "undefined") return "http://localhost:4000/ws/lesson";
  // Dev: connect directly to API on port 4000 (Next.js rewrites don't support WebSocket)
  // Prod: same origin via nginx proxy
  const { protocol, hostname, port } = window.location;
  const isLocalDev = hostname === "localhost" && port === "3000";
  if (isLocalDev) return "http://localhost:4000/ws/lesson";
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
  ENDPOINTING_MS: 300,
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
  OUTPUT_FORMAT: "mp3_22050_32",
  VOICE_SETTINGS: { stability: 0.35, similarity_boost: 0.75, style: 0.55 },
} as const;
