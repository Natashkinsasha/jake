import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { ChatMessage, LessonStatus } from "@/types";

export interface LessonState {
  lessonId: string | null;
  messages: ChatMessage[];
  status: LessonStatus;
  lessonEnded: boolean;
  error: string | null;
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
  pendingTurns: MutableRefObject<number>;
  activeMessageId: MutableRefObject<string | null>;
  streamStarted: MutableRefObject<boolean>;
  streamText: MutableRefObject<string>;
  pendingRevealText: MutableRefObject<string | null>;
  finalFullText: MutableRefObject<string | null>;
  revealedLen: MutableRefObject<number>;
  userSpeaking: MutableRefObject<boolean>;
  tts: MutableRefObject<TtsApi>;
}

export type SetLessonState = Dispatch<SetStateAction<LessonState>>;
export type Log = (...args: unknown[]) => void;
