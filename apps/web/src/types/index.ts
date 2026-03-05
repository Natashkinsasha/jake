// Shared types for the web app

export interface BackendUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  currentLevel: string | null;
}

export interface UserPreferences {
  correctionStyle?: string;
  explainGrammar?: boolean;
  useNativeLanguage?: boolean;
  speakingSpeed?: string;
}

// Lesson types

export type LessonStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export interface LessonListItem {
  id: string;
  status: string;
  topic: string | null;
  createdAt: string;
  duration: number | null;
  summary: string | null;
  lessonNumber: number;
}

export interface LessonDetail extends LessonListItem {
  messages: { role: string; content: string; timestamp: string }[];
}
