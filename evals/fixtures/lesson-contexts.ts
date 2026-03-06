import type { LessonContext } from "../../apps/api/src/@logic/lesson/application/dto/lesson-context";

export const returningStudentContext: LessonContext = {
  studentName: "Alex",
  level: "B1",
  lessonNumber: 5,
  lastLessonAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  tutorSystemPrompt: "",
  tutorVoiceId: "pNInz6obpgDQGcFmaJgB",
  tutorId: "jake-tutor-id",
  preferences: {
    correctionStyle: "natural",
    explainGrammar: true,
    speakingSpeed: "natural",
    useNativeLanguage: false,
    preferredExercises: ["fill_the_gap", "multiple_choice"],
    interests: ["programming", "movies", "travel"],
  },
  facts: [
    { category: "personal", fact: "Lives in Berlin" },
    { category: "work", fact: "Works as a software developer" },
    { category: "hobby", fact: "Likes watching sci-fi movies" },
    { category: "travel", fact: "Visited Japan last year" },
  ],
  recentEmotionalContext: [],
  learningFocus: {
    weakAreas: ["present_perfect", "conditionals"],
    strongAreas: ["past_simple", "present_simple"],
    recentWords: ["essentially", "nevertheless", "straightforward", "accomplish"],
    suggestedTopics: ["present_perfect", "conditionals"],
  },
};

export const firstLessonContext: LessonContext = {
  studentName: "Alex",
  level: null,
  lessonNumber: 1,
  lastLessonAt: null,
  tutorSystemPrompt: "",
  tutorVoiceId: "pNInz6obpgDQGcFmaJgB",
  tutorId: "jake-tutor-id",
  preferences: {
    correctionStyle: "natural",
    explainGrammar: true,
    speakingSpeed: "natural",
    useNativeLanguage: false,
    preferredExercises: [],
    interests: [],
  },
  facts: [],
  recentEmotionalContext: [],
  learningFocus: {
    weakAreas: [],
    strongAreas: [],
    recentWords: [],
    suggestedTopics: [],
  },
};
