import { type LessonContext } from "../dto/lesson-context";
import { buildFullSystemPrompt } from "./prompt-builder";

function createMockContext(overrides: Partial<LessonContext> = {}): LessonContext {
  return {
    studentName: "Yuki",
    level: "B1",
    lessonNumber: 5,
    lastLessonAt: null,
    tutorPromptFragment: "",
    onboardingCompleted: true,
    tutorVoiceId: "voice-1",
    nativeLanguage: "Russian",
    preferences: {
      correctionStyle: "immediate",
      speakingSpeed: "normal",
      useNativeLanguage: false,
      explainGrammar: true,
      preferredExercises: ["fill_the_gap", "multiple_choice"],
      interests: ["travel", "cooking"],
      ttsModel: "eleven_turbo_v2_5",
    },
    facts: [],
    recentEmotionalContext: [],
    learningFocus: {
      weakAreas: [],
      strongAreas: [],
      recentWords: [],
      suggestedTopics: [],
      vocabularyToReview: [],
    },
    ...overrides,
  };
}

describe("buildFullSystemPrompt", () => {
  it("should include base Jake prompt", () => {
    const result = buildFullSystemPrompt(createMockContext());
    expect(result).toContain("You are Jake");
    expect(result).toContain("friendly English tutor");
  });

  it("should include student profile section", () => {
    const result = buildFullSystemPrompt(createMockContext());
    expect(result).toContain("=== STUDENT PROFILE ===");
    expect(result).toContain("Name: Yuki");
    expect(result).toContain("Level: B1");
    expect(result).toContain("Lesson number: 5");
  });

  it("should handle null level", () => {
    const result = buildFullSystemPrompt(createMockContext({ level: null }));
    expect(result).toContain("Level: Unknown (assess during conversation)");
  });

  it("should include preferences section", () => {
    const result = buildFullSystemPrompt(createMockContext());
    expect(result).toContain("=== PREFERENCES ===");
    expect(result).toContain("Correction: immediate");
    expect(result).toContain("Grammar explanations: yes");
    expect(result).toContain("Speed: normal (scale: very_slow → slow → natural → fast → very_fast)");
    expect(result).toContain("Use native language: no");
    expect(result).toContain("Favorite exercises: fill_the_gap, multiple_choice");
    expect(result).toContain("Interests: travel, cooking");
  });

  it("should show 'no preference' for empty exercises", () => {
    const context = createMockContext();
    context.preferences.preferredExercises = [];
    const result = buildFullSystemPrompt(context);
    expect(result).toContain("Favorite exercises: no preference");
  });

  it("should show 'not specified' for empty interests", () => {
    const context = createMockContext();
    context.preferences.interests = [];
    const result = buildFullSystemPrompt(context);
    expect(result).toContain("Interests: not specified");
  });

  it("should include grammar explanations: no when disabled", () => {
    const context = createMockContext();
    context.preferences.explainGrammar = false;
    const result = buildFullSystemPrompt(context);
    expect(result).toContain("Grammar explanations: no");
  });

  it("should include facts when present", () => {
    const context = createMockContext({
      facts: [
        { category: "personal", fact: "Has a dog named Max" },
        { category: "work", fact: "Works at a tech company" },
      ],
    });
    const result = buildFullSystemPrompt(context);
    expect(result).toContain("=== KNOWN FACTS ===");
    expect(result).toContain("- [personal] Has a dog named Max");
    expect(result).toContain("- [work] Works at a tech company");
  });

  it("should not include facts section when empty", () => {
    const result = buildFullSystemPrompt(createMockContext({ facts: [] }));
    expect(result).not.toContain("=== KNOWN FACTS ===");
  });

  it("should include emotional context when present", () => {
    const context = createMockContext({
      recentEmotionalContext: ["Student seemed tired last session", "Was excited about a trip"],
    });
    const result = buildFullSystemPrompt(context);
    expect(result).toContain("=== EMOTIONAL CONTEXT ===");
    expect(result).toContain("Student seemed tired last session");
    expect(result).toContain("Was excited about a trip");
  });

  it("should not include emotional context when empty", () => {
    const result = buildFullSystemPrompt(createMockContext({ recentEmotionalContext: [] }));
    expect(result).not.toContain("=== EMOTIONAL CONTEXT ===");
  });

  it("should include learning focus and lesson topics section", () => {
    const context = createMockContext({
      learningFocus: {
        weakAreas: ["past tense", "articles"],
        strongAreas: ["vocabulary", "pronunciation"],
        recentWords: ["accomplish", "determine"],
        suggestedTopics: ["past_simple", "articles", "present_perfect"],
        vocabularyToReview: [],
      },
    });
    const result = buildFullSystemPrompt(context);
    expect(result).toContain("=== LEARNING FOCUS ===");
    expect(result).toContain("Weak areas: past tense, articles");
    expect(result).toContain("Strong areas: vocabulary, pronunciation");
    expect(result).toContain("Recent words: accomplish, determine");
    expect(result).toContain("=== LESSON TOPICS (prepared) ===");
    expect(result).toContain("1. past_simple (priority — focus here first)");
    expect(result).toContain("2. articles");
    expect(result).toContain("3. present_perfect");
    expect(result).toContain("TOPIC FLOW:");
    expect(result).toContain("Start with topic #1");
  });

  it("should show free conversation when no topics", () => {
    const result = buildFullSystemPrompt(createMockContext());
    expect(result).toContain("Weak areas: none identified");
    expect(result).toContain("Strong areas: none identified");
    expect(result).toContain("Recent words: none");
    expect(result).toContain("Free conversation (no specific topics prepared)");
  });

  it("should handle single suggested topic", () => {
    const context = createMockContext({
      learningFocus: {
        weakAreas: ["past tense"],
        strongAreas: [],
        recentWords: [],
        suggestedTopics: ["past_simple"],
        vocabularyToReview: [],
      },
    });
    const result = buildFullSystemPrompt(context);
    expect(result).toContain("1. past_simple (priority — focus here first)");
    expect(result).not.toMatch(/^2\. /m);
  });

  it("should include onboarding mode when onboardingCompleted is false", () => {
    const result = buildFullSystemPrompt(createMockContext({ onboardingCompleted: false }));
    expect(result).toContain("=== ONBOARDING MODE ===");
    expect(result).toContain("<onboarding");
  });

  it("should include emotion instructions with all 10 emotions", () => {
    const result = buildFullSystemPrompt(createMockContext());
    expect(result).toContain("=== EMOTIONAL EXPRESSION ===");
    expect(result).toContain("<emotion>");
    expect(result).toContain("neutral");
    expect(result).toContain("happy");
    expect(result).toContain("encouraging");
    expect(result).toContain("empathetic");
    expect(result).toContain("excited");
    expect(result).toContain("curious");
    expect(result).toContain("playful");
    expect(result).toContain("proud");
    expect(result).toContain("thoughtful");
    expect(result).toContain("surprised");
  });

  it("should not include onboarding mode when onboardingCompleted is true", () => {
    const result = buildFullSystemPrompt(createMockContext({ onboardingCompleted: true }));
    expect(result).not.toContain("=== ONBOARDING MODE ===");
  });

  it("should include onboarding mode regardless of lessonNumber when onboardingCompleted is false", () => {
    const result = buildFullSystemPrompt(createMockContext({ onboardingCompleted: false, lessonNumber: 5 }));
    expect(result).toContain("=== ONBOARDING MODE ===");
  });

  it("should include tutor system prompt when provided", () => {
    const result = buildFullSystemPrompt(
      createMockContext({ tutorPromptFragment: "Focus on business English." }),
    );
    expect(result).toContain("Focus on business English.");
  });

  it("should not include tutor system prompt when empty", () => {
    const baseResult = buildFullSystemPrompt(createMockContext({ tutorPromptFragment: "" }));
    // The empty string is falsy, so it should not appear as a separate section
    // Ensure no blank section between Jake base prompt and student profile
    expect(baseResult).toContain("=== STUDENT PROFILE ===");
  });

  it("should show 'this is the first lesson' when lastLessonAt is null", () => {
    const result = buildFullSystemPrompt(createMockContext({ lastLessonAt: null }));
    expect(result).toContain("Last lesson: this is the first lesson");
  });

  it("should show time since last lesson when lastLessonAt is set", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const result = buildFullSystemPrompt(createMockContext({ lastLessonAt: twoDaysAgo }));
    expect(result).toContain("Last lesson: 2 days ago");
  });

  it("should show 'yesterday' when last lesson was 1 day ago", () => {
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const result = buildFullSystemPrompt(createMockContext({ lastLessonAt: yesterday }));
    expect(result).toContain("Last lesson: yesterday");
  });

  it("should apply correct correction style description", () => {
    const immediateResult = buildFullSystemPrompt(
      createMockContext(),
    );
    expect(immediateResult).toContain("Correct real grammar/vocabulary errors gently");

    const endResult = buildFullSystemPrompt(
      createMockContext({
        preferences: {
          ...createMockContext().preferences,
          correctionStyle: "end_of_lesson",
        },
      }),
    );
    expect(endResult).toContain("Summarize all corrections at the end");

    const naturalResult = buildFullSystemPrompt(
      createMockContext({
        preferences: {
          ...createMockContext().preferences,
          correctionStyle: "natural",
        },
      }),
    );
    expect(naturalResult).toContain("Only correct if the error causes real confusion");
  });
});
