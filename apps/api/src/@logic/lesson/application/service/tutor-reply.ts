import type { LlmMessage } from "@lib/provider/src";
import { type Emotion, parseEmotion } from "./emotion";
import { extractExerciseTag } from "./exercise-tags";
import { stripUnknownTags } from "./unknown-tags";
import { extractVocabTags, type VocabHighlight } from "./vocab-tags";

const SET_SPEED_RE = /<set_speed>(very_slow|slow|natural|fast|very_fast)<\/set_speed>/g;

const ONBOARDING_RE = /<onboarding\s+status="(complete|in_progress)"(?:\s+level="(A1|A2|B1|B2|C1|C2)")?\s*\/>/g;

export function stripOnboardingTags(text: string): {
  cleanText: string;
  onboardingComplete: boolean;
  level: string | null;
} {
  let onboardingComplete = false;
  let level: string | null = null;
  const cleanText = text
    .replaceAll(ONBOARDING_RE, (_, status: string, lvl: string | undefined) => {
      if (status === "complete" && lvl) {
        onboardingComplete = true;
        level = lvl;
      }
      return "";
    })
    .trim();
  return { cleanText, onboardingComplete, level };
}

export function stripSpeedTags(text: string): { cleanText: string; speed: string | null } {
  let speed: string | null = null;
  const cleanText = text
    .replaceAll(SET_SPEED_RE, (_, s: string) => {
      speed = s;
      return "";
    })
    .trim();
  return { cleanText, speed };
}

export interface TutorReply {
  // What the student sees and hears: every control tag removed.
  cleanText: string;
  emotion: Emotion;
  speed: string | null;
  // Set when the reply completes onboarding.
  onboardingLevel: string | null;
  vocabHighlights: VocabHighlight[];
}

export function parseTutorReply(raw: string): TutorReply {
  const { cleanText: noSpeed, speed } = stripSpeedTags(raw);
  const { emotion, text: noEmotion } = parseEmotion(noSpeed);
  const { cleanText: noOnboarding, onboardingComplete, level } = stripOnboardingTags(noEmotion);
  const { cleanText: noExercise } = extractExerciseTag(noOnboarding);
  const { cleanText: noVocab, highlights } = extractVocabTags(noExercise);
  return {
    cleanText: stripUnknownTags(noVocab),
    emotion,
    speed,
    onboardingLevel: onboardingComplete ? level : null,
    vocabHighlights: highlights,
  };
}

// Stands in, in the LLM history, for a message moderation dropped; it is not something the student said
export const BLOCKED_MESSAGE = "[This message was blocked by the safety filter.]";

export interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
}

// The LLM history keeps raw replies (with control tags) and operator notes; people and
// downstream prompts get the conversation as it was heard.
export function toTranscript(history: LlmMessage[]): TranscriptMessage[] {
  const transcript: TranscriptMessage[] = [];
  for (const message of history) {
    if (message.role === "user" && message.content !== BLOCKED_MESSAGE) {
      transcript.push({ role: "user", content: message.content });
    } else if (message.role === "assistant") {
      transcript.push({ role: "assistant", content: parseTutorReply(message.content).cleanText });
    }
  }
  return transcript;
}
