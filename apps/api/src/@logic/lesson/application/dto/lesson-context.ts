export interface LessonContext {
  studentName: string;
  level: string | null;
  lessonNumber: number;
  tutorSystemPrompt: string;
  tutorVoiceId: string;
  tutorId: string;
  preferences: {
    correctionStyle: string;
    speakingSpeed: string;
    useNativeLanguage: boolean;
    explainGrammar: boolean;
    preferredExercises: string[];
    interests: string[];
  };
  facts: Array<{ category: string; fact: string }>;
  recentEmotionalContext: string[];
}
