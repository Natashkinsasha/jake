/**
 * Determine how long to wait after silence before flushing the speech buffer.
 * Inspired by RealtimeVoiceChat's punctuation-based pause system.
 *
 * Short pauses for complete sentences (. ! ?),
 * longer pauses for incomplete thoughts (no punctuation, ellipsis).
 */

interface SilenceDurationConfig {
  period: number;
  question: number;
  exclamation: number;
  ellipsis: number;
  noPunctuation: number;
}

export const SILENCE_DURATIONS: SilenceDurationConfig = {
  period: 400,
  question: 350,
  exclamation: 350,
  ellipsis: 1500,
  noPunctuation: 800,
};

export function getSilenceDuration(text: string): number {
  const trimmed = text.trimEnd();
  if (!trimmed) return SILENCE_DURATIONS.noPunctuation;

  if (trimmed.endsWith("...") || trimmed.endsWith("\u2026")) return SILENCE_DURATIONS.ellipsis;

  const lastChar = trimmed[trimmed.length - 1];
  if (lastChar === ".") return SILENCE_DURATIONS.period;
  if (lastChar === "?") return SILENCE_DURATIONS.question;
  if (lastChar === "!") return SILENCE_DURATIONS.exclamation;

  return SILENCE_DURATIONS.noPunctuation;
}
