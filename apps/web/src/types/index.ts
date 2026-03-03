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
  exercise?: LessonExercise | null;
}

export const EXERCISE_TYPES = {
  fill_the_gap: "fill_the_gap",
  multiple_choice: "multiple_choice",
  sentence_builder: "sentence_builder",
  error_correction: "error_correction",
} as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[keyof typeof EXERCISE_TYPES];

interface ExerciseBase {
  id: string;
  hint?: string;
}

export interface FillTheGapExercise extends ExerciseBase {
  type: "fill_the_gap";
  sentence: string;
}

export interface MultipleChoiceExercise extends ExerciseBase {
  type: "multiple_choice";
  question: string;
  options: string[];
}

export interface SentenceBuilderExercise extends ExerciseBase {
  type: "sentence_builder";
  words: string[];
}

export interface ErrorCorrectionExercise extends ExerciseBase {
  type: "error_correction";
  sentence: string;
}

export type LessonExercise =
  | FillTheGapExercise
  | MultipleChoiceExercise
  | SentenceBuilderExercise
  | ErrorCorrectionExercise;

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

// Homework types

export interface HomeworkListItem {
  id: string;
  lessonId: string;
  exercises: HomeworkExercise[];
  createdAt: string;
  dueAt: string | null;
  completedAt: string | null;
  score: number | null;
}

export interface HomeworkExercise {
  question?: string;
  sentence?: string;
  type?: ExerciseType;
  options?: string[];
  hint?: string;
}

// Vocabulary types

export interface VocabularyWord {
  id: string;
  word: string;
  strength: number;
  nextReview: string | null;
}

// Progress types

export interface ProgressData {
  currentLevel: string | null;
  grammarTopics: { topic: string; level: number; errorCount: number }[];
  totalLessons: number;
  totalWords: number;
}
