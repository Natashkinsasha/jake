// API & WebSocket URLs
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/api" : "http://localhost:4000");

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== "undefined"
    ? `${window.location.origin}/ws/lesson`
    : "http://localhost:4000/ws/lesson");

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

// TTS (ElevenLabs)
export const TTS_CONFIG = {
  MODEL_ID: "eleven_turbo_v2_5",
  DEFAULT_VOICE_ID: "onwK4e9ZLuTAKqWW03F9",
  MAX_TEXT_LENGTH: 2000,
  STABILITY: 0.5,
  SIMILARITY_BOOST: 0.75,
} as const;

// Lesson
export const LESSON_CONFIG = {
  SILENCE_MS: 1000,
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
