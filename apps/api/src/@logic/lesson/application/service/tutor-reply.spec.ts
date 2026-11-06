import { BLOCKED_MESSAGE, parseTutorReply, toTranscript } from "./tutor-reply";

describe("parseTutorReply", () => {
  it("strips every control tag and reads its values", () => {
    const raw =
      '<emotion>curious</emotion>So how\'s your <vocab word="commute" translation="дорога" topic="daily_life"/>commute? <set_speed>slow</set_speed><onboarding status="complete" level="B1"/>';

    expect(parseTutorReply(raw)).toEqual({
      cleanText: "So how's your commute?",
      emotion: "curious",
      speed: "slow",
      onboardingLevel: "B1",
      vocabHighlights: [{ word: "commute", translation: "дорога", topic: "daily_life" }],
    });
  });

  it("removes an exercise block", () => {
    const raw =
      '<emotion>happy</emotion>Let\'s practice! <exercise type="matching"><pair word="a" definition="b"/></exercise>';

    expect(parseTutorReply(raw).cleanText).toBe("Let's practice!");
  });

  it("ignores an in-progress onboarding tag", () => {
    expect(parseTutorReply('Hi! <onboarding status="in_progress"/>').onboardingLevel).toBeNull();
  });
});

describe("toTranscript", () => {
  it("drops system notes and cleans the tutor's replies", () => {
    expect(
      toTranscript([
        { role: "assistant", content: "<emotion>happy</emotion>Hey!" },
        { role: "user", content: "Hi <b>there</b>" },
        { role: "system", content: "Voice note" },
        { role: "assistant", content: "<emotion>empathetic</emotion>Are you okay?" },
        { role: "user", content: BLOCKED_MESSAGE },
      ]),
    ).toEqual([
      { role: "assistant", content: "Hey!" },
      { role: "user", content: "Hi <b>there</b>" },
      { role: "assistant", content: "Are you okay?" },
    ]);
  });
});
