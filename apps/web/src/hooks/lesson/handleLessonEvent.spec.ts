import { handleLessonEvent } from "./handleLessonEvent";

const idle = { userSpeaking: false, pendingTurns: 0 };

describe("handleLessonEvent", () => {
  it("lesson_started → set_state with lessonId", () => {
    const action = handleLessonEvent("lesson_started", { lessonId: "abc" }, idle);
    expect(action).toEqual({ type: "set_state", patch: { lessonId: "abc", status: "idle" } });
  });

  it("tutor_message with audio → play_audio", () => {
    const action = handleLessonEvent(
      "tutor_message",
      { text: "Hello", audio: "base64data", exercise: null },
      idle,
    );
    expect(action.type).toBe("play_audio");
    if (action.type === "play_audio") {
      expect(action.audio).toBe("base64data");
      expect(action.pending.text).toBe("Hello");
    }
  });

  it("tutor_message without audio → show_message", () => {
    const action = handleLessonEvent(
      "tutor_message",
      { text: "Hello", exercise: null },
      idle,
    );
    expect(action).toEqual({
      type: "show_message",
      text: "Hello",
      exercise: null,
      status: "idle",
    });
  });

  it("tutor_message discarded when user is speaking", () => {
    const action = handleLessonEvent(
      "tutor_message",
      { text: "Hello" },
      { userSpeaking: true, pendingTurns: 0 },
    );
    expect(action).toEqual({ type: "discard" });
  });

  it("tutor_message discarded when pendingTurns > 1", () => {
    const action = handleLessonEvent(
      "tutor_message",
      { text: "Hello" },
      { userSpeaking: false, pendingTurns: 2 },
    );
    expect(action).toEqual({ type: "discard" });
  });

  it("exercise_feedback with audio → play_audio", () => {
    const action = handleLessonEvent(
      "exercise_feedback",
      { text: "Correct!", audio: "audiodata" },
      idle,
    );
    expect(action.type).toBe("play_audio");
    if (action.type === "play_audio") {
      expect(action.pending.exercise).toBeNull();
    }
  });

  it("exercise_feedback without audio → show_message", () => {
    const action = handleLessonEvent(
      "exercise_feedback",
      { text: "Correct!" },
      idle,
    );
    expect(action).toEqual({
      type: "show_message",
      text: "Correct!",
      exercise: null,
      status: "idle",
    });
  });

  it("exercise_feedback discarded when user is speaking", () => {
    const action = handleLessonEvent(
      "exercise_feedback",
      { text: "Correct!", audio: "data" },
      { userSpeaking: true, pendingTurns: 0 },
    );
    expect(action).toEqual({ type: "discard" });
  });

  it("transcript → show_message with transcript status", () => {
    const action = handleLessonEvent("transcript", { text: "I said hello" }, idle);
    expect(action).toEqual({
      type: "show_message",
      text: "I said hello",
      exercise: null,
      status: "transcript",
    });
  });

  it("lesson_ended → set_state", () => {
    const action = handleLessonEvent("lesson_ended", {}, idle);
    expect(action).toEqual({ type: "set_state", patch: { status: "idle", lessonEnded: true } });
  });

  it("error → set_state idle", () => {
    const action = handleLessonEvent("error", { message: "oops" }, idle);
    expect(action).toEqual({ type: "set_state", patch: { status: "idle" } });
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

  it("tutor_message with exercise → includes exercise in pending", () => {
    const exercise = { type: "fill_the_gap" as const, id: "ex1", sentence: "I ___ a cat" };
    const action = handleLessonEvent(
      "tutor_message",
      { text: "Fill this", audio: "data", exercise },
      idle,
    );
    if (action.type === "play_audio") {
      expect(action.pending.exercise).toEqual(exercise);
    }
  });
});
