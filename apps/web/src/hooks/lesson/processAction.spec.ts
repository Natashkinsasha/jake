import { processAction } from "./processAction";
import type { LessonRefs, LessonState, TtsApi } from "./types";

function makeRefs(): LessonRefs {
  const ref = <T>(current: T) => ({ current });
  const tts: TtsApi = {
    speak: jest.fn(),
    startStream: jest.fn(),
    sendChunk: jest.fn(),
    endStream: jest.fn(),
    stop: jest.fn(),
    preWarm: jest.fn(),
  };
  return {
    voiceId: ref<string | null>("voice"),
    speechSpeed: ref(1),
    ttsModel: ref<string | undefined>(undefined),
    systemPrompt: ref<string | null>(null),
    emotion: ref("neutral"),
    greetingPlaying: ref(false),
    seenVocab: ref(new Set<string>()),
    awaitingReply: ref(false),
    activeMessageId: ref<string | null>(null),
    streamStarted: ref(false),
    streamText: ref(""),
    pendingRevealText: ref<string | null>(null),
    finalFullText: ref<string | null>(null),
    revealedLen: ref(0),
    ttsFailed: ref(false),
    userSpeaking: ref(false),
    tts: ref(tts),
  };
}

function makeState() {
  let state: LessonState = {
    lessonId: "l1",
    messages: [],
    status: "thinking",
    lessonEnded: false,
    error: null,
    notice: null,
    startedAt: null,
  };
  const setState = jest.fn((update: LessonState | ((prev: LessonState) => LessonState)) => {
    state = typeof update === "function" ? update(state) : update;
  });
  return { get: () => state, setState };
}

const log = () => undefined;

describe("processAction", () => {
  it("stops awaiting a reply when one ends", () => {
    const refs = makeRefs();
    const { setState } = makeState();
    refs.awaitingReply.current = true;
    refs.activeMessageId.current = "m1";

    processAction(
      { type: "stream_end", fullText: "Hi!", messageId: "m1" },
      "tutor_stream_end",
      {},
      refs,
      setState,
      log,
    );

    expect(refs.awaitingReply.current).toBe(false);
    expect(refs.tts.current.endStream).toHaveBeenCalled();
  });

  it("shows text directly and ends the reply when TTS failed", () => {
    const refs = makeRefs();
    const state = makeState();
    refs.activeMessageId.current = "m1";
    const chunk = (text: string) =>
      processAction(
        { type: "stream_chunk", chunkIndex: 0, text, messageId: "m1" },
        "tutor_chunk",
        {},
        refs,
        state.setState,
        log,
      );

    chunk("Hello there.");
    refs.ttsFailed.current = true; // the TTS socket errors mid-reply
    chunk("How are you?");

    expect(refs.tts.current.sendChunk).toHaveBeenCalledTimes(1);
    expect(state.get().messages.at(-1)?.text).toBe("Hello there. How are you?");

    processAction(
      { type: "stream_end", fullText: "Hello there! How are you?", messageId: "m1" },
      "tutor_stream_end",
      {},
      refs,
      state.setState,
      log,
    );
    expect(state.get().status).toBe("idle");
    expect(state.get().messages.at(-1)?.text).toBe("Hello there! How are you?");
  });

  it("ends a failed reply with what arrived and keeps the lesson going", () => {
    const refs = makeRefs();
    const state = makeState();
    refs.activeMessageId.current = "m1";
    refs.streamStarted.current = true;
    refs.streamText.current = "Partial answer";

    processAction(
      { type: "turn_error", message: "Something went wrong!", messageId: "m1" },
      "error",
      {},
      refs,
      state.setState,
      log,
    );

    expect(refs.tts.current.endStream).toHaveBeenCalled();
    expect(refs.finalFullText.current).toBe("Partial answer");
    expect(state.get().notice?.message).toBe("Something went wrong!");
    expect(state.get().error).toBeNull();
  });

  it("ignores an error for a reply that is no longer active", () => {
    const refs = makeRefs();
    const state = makeState();
    refs.activeMessageId.current = "m2";

    processAction({ type: "turn_error", message: "x", messageId: "m1" }, "error", {}, refs, state.setState, log);

    expect(state.setState).not.toHaveBeenCalled();
    expect(refs.activeMessageId.current).toBe("m2");
  });
});
