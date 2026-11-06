import { EMOTION_VOICE_SETTINGS } from "@/lib/config";
import type { LessonAction, LessonEventData } from "./handleLessonEvent";
import type { LessonRefs, LessonState, Log, SetLessonState } from "./types";

// Puts `text` into the reply bubble at the end of the chat, adding one if needed.
export function withReplyText(messages: LessonState["messages"], text: string): LessonState["messages"] {
  const next = [...messages];
  const last = next.at(-1);
  if (last?.role === "assistant") {
    next[next.length - 1] = { ...last, text };
  } else {
    next.push({ role: "assistant", text, timestamp: Date.now() });
  }
  return next;
}

function getVoiceSettings(refs: LessonRefs) {
  return refs.emotion.current !== "neutral" ? EMOTION_VOICE_SETTINGS[refs.emotion.current] : undefined;
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
    if (event === "status" && patch["status"] === undefined) {
      return prev;
    }
    return { ...prev, ...patch } as LessonState;
  });
  if (event === "error") {
    log("ERROR:", data.message);
  }
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
    refs.tts.current.speak(
      action.text,
      refs.voiceId.current,
      refs.speechSpeed.current,
      refs.ttsModel.current,
      getVoiceSettings(refs),
    );
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
    refs.ttsFailed.current = false;
    refs.tts.current.startStream(
      refs.voiceId.current,
      refs.speechSpeed.current,
      refs.ttsModel.current,
      getVoiceSettings(refs),
    );
  }

  if (!refs.ttsFailed.current) {
    refs.tts.current.sendChunk(action.text);
  }

  const sep = refs.streamText.current && !/^[,.\-!?;:'"]/.test(action.text) ? " " : "";
  refs.streamText.current += sep + action.text;
  refs.pendingRevealText.current = refs.streamText.current;

  if (refs.ttsFailed.current) {
    // No audio drives the reveal: show the text as it arrives
    const text = refs.streamText.current;
    setState((prev) => ({ ...prev, messages: withReplyText(prev.messages, text), status: "speaking" }));
    return;
  }

  setState((prev) => {
    const messages = [...prev.messages];
    const last = messages.at(-1);
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
  setState: SetLessonState,
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

  // The server answers only the latest message, so nothing else is still pending
  refs.awaitingReply.current = false;
  refs.activeMessageId.current = null;
  refs.streamStarted.current = false;
  refs.streamText.current = "";
  if (refs.ttsFailed.current) {
    // No audio will finish, so nothing else would end the turn
    refs.finalFullText.current = null;
    refs.pendingRevealText.current = null;
    setState((prev) => ({ ...prev, messages: withReplyText(prev.messages, action.fullText), status: "idle" }));
    return;
  }
  refs.tts.current.endStream();
  refs.finalFullText.current = action.fullText;
}

// The reply in flight failed on the server: end it with whatever arrived and tell the student.
function processTurnError(
  action: Extract<LessonAction, { type: "turn_error" }>,
  refs: LessonRefs,
  setState: SetLessonState,
  log: Log,
): void {
  if (action.messageId && action.messageId !== refs.activeMessageId.current) {
    log("ignoring error for a stale turn");
    return;
  }
  const notice = { message: action.message, at: Date.now() };
  const partial = refs.streamText.current;
  const audioPlaying = refs.streamStarted.current && !refs.ttsFailed.current;

  refs.awaitingReply.current = false;
  refs.activeMessageId.current = null;
  refs.streamStarted.current = false;
  refs.streamText.current = "";

  if (audioPlaying) {
    // Let the audio already received finish; onAllDone then shows the text and goes idle
    refs.finalFullText.current = partial || null;
    refs.tts.current.endStream();
    setState((prev) => ({ ...prev, notice }));
    return;
  }
  setState((prev) => ({
    ...prev,
    messages: partial ? withReplyText(prev.messages, partial) : prev.messages,
    status: "idle",
    notice,
  }));
}

function processStreamDiscard(refs: LessonRefs, setState: SetLessonState): void {
  refs.awaitingReply.current = false;
  refs.activeMessageId.current = null;
  refs.streamStarted.current = false;
  refs.streamText.current = "";
  refs.pendingRevealText.current = null;
  refs.finalFullText.current = null;
  refs.revealedLen.current = 0;
  refs.tts.current.stop();

  setState((prev) => {
    const messages = [...prev.messages];
    const last = messages.at(-1);
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
      processStreamEnd(action, refs, setState, log);
      break;
    case "turn_error":
      processTurnError(action, refs, setState, log);
      break;
    case "stream_discard":
      processStreamDiscard(refs, setState);
      break;
    case "discard":
      if (event === "tutor_message" || event === "exercise_feedback" || event === "tutor_chunk") {
        log("discarding", event);
      }
      break;
    default:
      break;
  }
}
