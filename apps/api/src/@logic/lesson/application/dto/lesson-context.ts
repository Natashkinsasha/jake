export interface LessonContext {
  studentName: string;
  level: string | null;
  lessonNumber: number;
  lastLessonAt: Date | null;
  tutorPromptFragment: string;
  tutorVoiceId: string;
  preferences: {
    correctionStyle: string;
    speakingSpeed: string;
    useNativeLanguage: boolean;
    explainGrammar: boolean;
    preferredExercises: string[];
    interests: string[];
    ttsModel: string;
  };
  facts: Array<{ category: string; fact: string }>;
  recentEmotionalContext: string[];
  learningFocus: {
    weakAreas: string[];
    strongAreas: string[];
    recentWords: string[];
    suggestedTopics: string[];
  };
}
