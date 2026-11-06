import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { ChatMessage, LessonStatus } from "@/types";

export interface LessonState {
  lessonId: string | null;
  messages: ChatMessage[];
  status: LessonStatus;
  lessonEnded: boolean;
  // A fatal error ends the lesson screen; a notice is only shown as a toast
  error: string | null;
  notice: { message: string; at: number } | null;
  startedAt: number | null;
}

export interface TtsApi {
  speak: (
    text: string,
    voiceId: string,
    speed: number,
    model?: string,
    voiceSettings?: { stability: number; similarity_boost: number; style: number },
  ) => void;
  startStream: (
    voiceId: string,
    speed: number,
    model?: string,
    voiceSettings?: { stability: number; similarity_boost: number; style: number },
  ) => void;
  sendChunk: (text: string) => void;
  endStream: () => void;
  stop: () => void;
  preWarm: (voiceId: string, speed: number, model?: string) => void;
}

export interface LessonRefs {
  voiceId: MutableRefObject<string | null>;
  speechSpeed: MutableRefObject<number>;
  ttsModel: MutableRefObject<string | undefined>;
  systemPrompt: MutableRefObject<string | null>;
  emotion: MutableRefObject<string>;
  greetingPlaying: MutableRefObject<boolean>;
  seenVocab: MutableRefObject<Set<string>>;
  // The student sent a message the server hasn't answered yet
  awaitingReply: MutableRefObject<boolean>;
  activeMessageId: MutableRefObject<string | null>;
  streamStarted: MutableRefObject<boolean>;
  streamText: MutableRefObject<string>;
  pendingRevealText: MutableRefObject<string | null>;
  finalFullText: MutableRefObject<string | null>;
  revealedLen: MutableRefObject<number>;
  // TTS failed for the current reply: show its text directly instead of revealing it with the audio
  ttsFailed: MutableRefObject<boolean>;
  userSpeaking: MutableRefObject<boolean>;
  tts: MutableRefObject<TtsApi>;
}

export type SetLessonState = Dispatch<SetStateAction<LessonState>>;
export type Log = (...args: unknown[]) => void;
