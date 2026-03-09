// Shared types for the web app

export interface BackendUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  nativeLanguage: string | null;
  currentLevel: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface UserPreferences {
  correctionStyle?: string;
  explainGrammar?: boolean;
  useNativeLanguage?: boolean;
  speakingSpeed?: string;
  ttsModel?: string;
  tutorGender?: string | null;
  tutorNationality?: string | null;
  tutorVoiceId?: string | null;
}

// Lesson types

export type LessonStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking";

export interface VocabHighlight {
  word: string;
  translation: string;
  topic: string;
  saved?: boolean;
}

// Exercise types

export interface ExercisePair {
  word: string;
  definition: string;
}

export interface ExerciseData {
  exerciseId: string;
  type: "matching";
  pairs: ExercisePair[];
}

export interface ExerciseResult {
  word: string;
  correct: boolean;
  correctDefinition: string;
}

export interface ExerciseFeedbackData {
  exerciseId: string;
  results: ExerciseResult[];
  score: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "exercise";
  text: string;
  timestamp: number;
  vocabHighlights?: VocabHighlight[];
  exercise?: ExerciseData;
  exerciseFeedback?: ExerciseFeedbackData;
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

// Vocabulary types

export interface VocabularyItem {
  id: string;
  word: string;
  translation: string | null;
  topic: string | null;
  status: "new" | "learning" | "learned";
  reviewCount: number;
  lastReviewedAt: string | null;
  lessonId: string | null;
  createdAt: string;
}

export interface VocabularyStats {
  total: number;
  new: number;
  learning: number;
  learned: number;
}
