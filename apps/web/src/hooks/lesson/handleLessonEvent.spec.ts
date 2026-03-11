import { handleLessonEvent } from "./handleLessonEvent";

const idle = { userSpeaking: false, pendingTurns: 0 };

describe("handleLessonEvent", () => {
  it("lesson_started → set_state with lessonId", () => {
    const action = handleLessonEvent("lesson_started", { lessonId: "abc" }, idle);
    expect(action).toEqual({ type: "set_state", patch: { lessonId: "abc", status: "idle" } });
  });

  it("tutor_message → show_message", () => {
    const action = handleLessonEvent("tutor_message", { text: "Hello" }, idle);
    expect(action).toEqual({
      type: "show_message",
      text: "Hello",
      status: "idle",
    });
  });

  it("tutor_message discarded when user is speaking", () => {
    const action = handleLessonEvent("tutor_message", { text: "Hello" }, { userSpeaking: true, pendingTurns: 0 });
    expect(action).toEqual({ type: "discard" });
  });

  it("tutor_message discarded when pendingTurns > 1", () => {
    const action = handleLessonEvent("tutor_message", { text: "Hello" }, { userSpeaking: false, pendingTurns: 2 });
    expect(action).toEqual({ type: "discard" });
  });

  it("transcript → show_message with transcript status", () => {
    const action = handleLessonEvent("transcript", { text: "I said hello" }, idle);
    expect(action).toEqual({
      type: "show_message",
      text: "I said hello",
      status: "transcript",
    });
  });

  it("lesson_ended → set_state", () => {
    const action = handleLessonEvent("lesson_ended", {}, idle);
    expect(action).toEqual({ type: "set_state", patch: { status: "idle", lessonEnded: true } });
  });

  it("error → set_state idle with error message", () => {
    const action = handleLessonEvent("error", { message: "oops" }, idle);
    expect(action).toEqual({ type: "set_state", patch: { status: "idle", error: "oops" } });
  });

  it("error without message → set_state with default error", () => {
    const action = handleLessonEvent("error", {}, idle);
    expect(action).toEqual({ type: "set_state", patch: { status: "idle", error: "Something went wrong" } });
  });

  it("status thinking → set_state", () => {
    const action = handleLessonEvent("status", { state: "thinking" }, idle);
    expect(action).toEqual({ type: "set_state", patch: { status: "thinking" } });
  });

  it("status other → set_state with undefined status", () => {
    const action = handleLessonEvent("status", { state: "listening" }, idle);
    expect(action).toEqual({ type: "set_state", patch: { status: undefined } });
  });

  it("unknown event → discard", () => {
    const action = handleLessonEvent("unknown_event", {}, idle);
    expect(action).toEqual({ type: "discard" });
  });
});
