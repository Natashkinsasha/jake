import type { LessonAction, LessonEventData } from "./handleLessonEvent";
import type { LessonRefs, LessonState, SetLessonState, Log } from "./types";
import { EMOTION_VOICE_SETTINGS } from "@/lib/config";

function getVoiceSettings(refs: LessonRefs) {
  return refs.emotion.current !== "neutral"
    ? EMOTION_VOICE_SETTINGS[refs.emotion.current]
    : undefined;
}

function processSetState(
  action: Extract<LessonAction, { type: "set_state" }>,
  event: string,
  data: LessonEventData,
  setState: SetLessonState,
  log: Log,
): void {
  setState((prev) => {
    const patch = action.patch;
    if (event === "status" && patch["status"] === undefined) return prev;
    return { ...prev, ...patch } as LessonState;
  });
  if (event === "error") log("ERROR:", data.message);
}

function processShowMessage(
  action: Extract<LessonAction, { type: "show_message" }>,
  refs: LessonRefs,
  setState: SetLessonState,
): void {
  if (action.text && refs.voiceId.current) {
    refs.pendingRevealText.current = action.text;
    refs.revealedLen.current = 0;
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, { role: "assistant" as const, text: "", timestamp: Date.now() }],
      status: "speaking",
    }));
    refs.tts.current.speak(action.text, refs.voiceId.current, refs.speechSpeed.current, refs.ttsModel.current, getVoiceSettings(refs));
  } else {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, { role: "assistant" as const, text: action.text, timestamp: Date.now() }],
      status: "idle",
    }));
  }
}

function processStreamChunk(
  action: Extract<LessonAction, { type: "stream_chunk" }>,
  refs: LessonRefs,
  setState: SetLessonState,
  log: Log,
): void {
  if (action.messageId && refs.activeMessageId.current && action.messageId !== refs.activeMessageId.current) {
    log("discarding stale chunk, messageId mismatch");
    return;
  }
  if (action.messageId && !refs.activeMessageId.current) {
    log("discarding chunk, no active generation");
    return;
  }

  if (!refs.streamStarted.current && refs.voiceId.current) {
    refs.streamStarted.current = true;
    refs.revealedLen.current = 0;
    refs.finalFullText.current = null;
    refs.tts.current.startStream(refs.voiceId.current, refs.speechSpeed.current, refs.ttsModel.current, getVoiceSettings(refs));
  }

  refs.tts.current.sendChunk(action.text);

  const sep = refs.streamText.current && !/^[,.\-!?;:'"]/.test(action.text) ? " " : "";
  refs.streamText.current += sep + action.text;
  refs.pendingRevealText.current = refs.streamText.current;

  setState((prev) => {
    const messages = [...prev.messages];
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant") {
      messages.push({ role: "assistant", text: "", timestamp: Date.now() });
      return { ...prev, messages, status: "speaking" };
    }
    return prev.status === "speaking" ? prev : { ...prev, status: "speaking" };
  });
}

function processStreamEnd(
  action: Extract<LessonAction, { type: "stream_end" }>,
  refs: LessonRefs,
  log: Log,
): void {
  if (action.messageId && refs.activeMessageId.current && action.messageId !== refs.activeMessageId.current) {
    log("discarding stale stream_end, messageId mismatch");
    return;
  }
  if (action.messageId && !refs.activeMessageId.current) {
    log("discarding stream_end, no active generation");
    return;
  }

  refs.activeMessageId.current = null;
  refs.streamStarted.current = false;
  refs.tts.current.endStream();
  refs.streamText.current = "";
  refs.finalFullText.current = action.fullText;
}

function processStreamDiscard(refs: LessonRefs, setState: SetLessonState): void {
  refs.pendingTurns.current = Math.max(0, refs.pendingTurns.current - 1);
  refs.activeMessageId.current = null;
  refs.streamStarted.current = false;
  refs.streamText.current = "";
  refs.pendingRevealText.current = null;
  refs.finalFullText.current = null;
  refs.revealedLen.current = 0;
  refs.tts.current.stop();

  setState((prev) => {
    const messages = [...prev.messages];
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      messages.pop();
    }
    return { ...prev, messages, status: "idle" };
  });
}

export function processAction(
  action: LessonAction,
  event: string,
  data: LessonEventData,
  refs: LessonRefs,
  setState: SetLessonState,
  log: Log,
): void {
  switch (action.type) {
    case "set_state":
      processSetState(action, event, data, setState, log);
      break;
    case "show_message":
      processShowMessage(action, refs, setState);
      break;
    case "stream_chunk":
      processStreamChunk(action, refs, setState, log);
      break;
    case "stream_end":
      processStreamEnd(action, refs, log);
      break;
    case "stream_discard":
      processStreamDiscard(refs, setState);
      break;
    case "discard":
      if (event === "tutor_message" || event === "exercise_feedback" || event === "tutor_chunk") {
        log("discarding", event);
      }
      break;
  }
}
