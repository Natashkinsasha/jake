import { handleLessonEvent } from "./handleLessonEvent";

const idle = { userSpeaking: false, awaitingReply: false };

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
    const action = handleLessonEvent("tutor_message", { text: "Hello" }, { userSpeaking: true, awaitingReply: false });
    expect(action).toEqual({ type: "discard" });
  });

  it("tutor_message discarded when the student sent a newer message", () => {
    const action = handleLessonEvent("tutor_message", { text: "Hello" }, { userSpeaking: false, awaitingReply: true });
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

  it("fatal error → set_state idle with error message", () => {
    const action = handleLessonEvent("error", { message: "oops", fatal: true }, idle);
    expect(action).toEqual({ type: "set_state", patch: { status: "idle", error: "oops" } });
  });

  it("fatal error without message → set_state with default error", () => {
    const action = handleLessonEvent("error", { fatal: true }, idle);
    expect(action).toEqual({ type: "set_state", patch: { status: "idle", error: "Something went wrong" } });
  });

  it("failed reply → turn_error, the lesson goes on", () => {
    const action = handleLessonEvent("error", { message: "Something went wrong!", turn: true, messageId: "m1" }, idle);
    expect(action).toEqual({ type: "turn_error", message: "Something went wrong!", messageId: "m1" });
  });

  it("rejected request → notice only", () => {
    const action = handleLessonEvent("error", { message: "No active exercise" }, idle);
    expect(action).toEqual({
      type: "set_state",
      patch: { notice: { message: "No active exercise", at: expect.any(Number) } },
    });
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
