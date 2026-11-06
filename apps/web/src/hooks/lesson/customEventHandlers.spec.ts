import { handleCustomEvent } from "./customEventHandlers";
import type { LessonRefs, LessonState } from "./types";

function setup(lessonId: string | null) {
  let state = {
    lessonId,
    messages: [{ role: "assistant", text: "Old lesson", timestamp: 1 }],
    status: "idle",
    lessonEnded: false,
    error: null,
    notice: null,
    startedAt: null,
  } as LessonState;
  const setState = (update: LessonState | ((prev: LessonState) => LessonState)) => {
    state = typeof update === "function" ? update(state) : update;
  };
  const refs = {
    voiceId: { current: null },
    speechSpeed: { current: 1 },
    ttsModel: { current: undefined },
    systemPrompt: { current: null },
    emotion: { current: "neutral" },
    greetingPlaying: { current: false },
  } as unknown as LessonRefs;
  return { refs, setState, get: () => state };
}

describe("lesson_started", () => {
  it("clears the chat when the server started a new lesson after ending the old one", () => {
    const { refs, setState, get } = setup("lesson-1");

    handleCustomEvent("lesson_started", { lessonId: "lesson-2" }, refs, setState, () => undefined);

    expect(get().messages).toEqual([]);
    expect(get().notice?.message).toContain("previous lesson was saved");
  });

  it("keeps the chat for the first lesson_started", () => {
    const { refs, setState, get } = setup(null);

    handleCustomEvent("lesson_started", { lessonId: "lesson-1" }, refs, setState, () => undefined);

    expect(get().messages).toHaveLength(1);
    expect(get().notice).toBeNull();
  });
});
