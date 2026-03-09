import type { LessonEventData } from "./handleLessonEvent";
import type { LessonRefs, SetLessonState, Log } from "./types";
import type { ChatMessage } from "@/types";

type ExtendedData<T> = LessonEventData & T;

function handleLessonStarted(
  data: LessonEventData,
  refs: LessonRefs,
  setState: SetLessonState,
): void {
  const d = data as ExtendedData<{ voiceId?: string; speechSpeed?: number; ttsModel?: string; systemPrompt?: string; emotion?: string }>;
  if (d.voiceId) refs.voiceId.current = d.voiceId;
  if (d.speechSpeed != null) refs.speechSpeed.current = d.speechSpeed;
  if (d.ttsModel) refs.ttsModel.current = d.ttsModel;
  if (d.systemPrompt) refs.systemPrompt.current = d.systemPrompt;
  if (d.emotion) refs.emotion.current = d.emotion;
  refs.greetingPlaying.current = true;
  setState((prev) => ({ ...prev, startedAt: Date.now() }));
}

function handleLessonResumed(
  data: LessonEventData,
  refs: LessonRefs,
  setState: SetLessonState,
): void {
  const d = data as ExtendedData<{
    lessonId?: string;
    voiceId?: string;
    speechSpeed?: number;
    startedAt?: number;
    history?: Array<{ role: "user" | "assistant"; text: string }>;
  }>;
  if (d.voiceId) refs.voiceId.current = d.voiceId;
  if (d.speechSpeed != null) refs.speechSpeed.current = d.speechSpeed;

  const messages: ChatMessage[] = (d.history ?? []).map((msg) => ({
    role: msg.role,
    text: msg.text,
    timestamp: Date.now(),
  }));

  setState({
    lessonId: d.lessonId ?? null,
    messages,
    status: "idle",
    lessonEnded: false,
    error: null,
    startedAt: d.startedAt ?? null,
  });
}

function handleTutorEmotion(data: LessonEventData, refs: LessonRefs): void {
  const d = data as ExtendedData<{ emotion?: string }>;
  if (d.emotion) refs.emotion.current = d.emotion;
}

function handleVocabHighlight(
  data: LessonEventData,
  refs: LessonRefs,
  setState: SetLessonState,
  log: Log,
): void {
  const d = data as ExtendedData<{ word?: string; translation?: string; topic?: string }>;
  log("vocab_highlight received:", d.word, d.translation, d.topic);

  if (!d.word || !d.translation || !d.topic) return;

  const key = d.word.toLowerCase();
  if (refs.seenVocab.current.has(key)) {
    log("vocab_highlight skipped (duplicate):", d.word);
    return;
  }
  refs.seenVocab.current.add(key);

  const highlight = { word: d.word, translation: d.translation, topic: d.topic, saved: false };
  setState((prev) => {
    const messages = [...prev.messages];
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      const existing = last.vocabHighlights ?? [];
      messages[messages.length - 1] = { ...last, vocabHighlights: [...existing, highlight] };
    } else {
      messages.push({ role: "assistant", text: "", timestamp: Date.now(), vocabHighlights: [highlight] });
    }
    return { ...prev, messages };
  });
}

function handleSpeedUpdated(data: LessonEventData, refs: LessonRefs, log: Log): void {
  const speedMap: Record<string, number> = { very_slow: 0.7, slow: 0.85, normal: 1.0, natural: 1.0, fast: 1.15, very_fast: 1.3 };
  const d = data as ExtendedData<{ speed?: string }>;
  if (d.speed && speedMap[d.speed] != null) {
    refs.speechSpeed.current = speedMap[d.speed] ?? 1.0;
    log("speed updated to:", d.speed, refs.speechSpeed.current);
  }
}

function handleExercise(data: LessonEventData, setState: SetLessonState): void {
  const d = data as ExtendedData<{ exerciseId?: string; type?: string; pairs?: Array<{ word: string; definition: string }> }>;
  const { exerciseId, type, pairs } = d;
  if (!exerciseId || !type || !pairs) return;

  setState((prev) => {
    const messages = prev.messages.filter(
      (m) => !(m.role === "exercise" && !m.exerciseFeedback),
    );
    return {
      ...prev,
      messages: [
        ...messages,
        {
          role: "exercise" as const,
          text: "",
          timestamp: Date.now(),
          exercise: { exerciseId, type: type as "matching", pairs },
        },
      ],
    };
  });
}

function handleExerciseFeedback(
  data: LessonEventData,
  refs: LessonRefs,
  setState: SetLessonState,
): void {
  const d = data as ExtendedData<{ exerciseId?: string; results?: Array<{ word: string; correct: boolean; correctDefinition: string }>; score?: string }>;
  const { exerciseId, results, score } = d;
  if (!exerciseId || !results || !score) return;

  setState((prev) => {
    const messages = [...prev.messages];
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.role === "exercise" && msg.exercise?.exerciseId === exerciseId) {
        messages[i] = { ...msg, exerciseFeedback: { exerciseId, results, score } };
        break;
      }
    }
    return { ...prev, messages };
  });
  refs.pendingTurns.current = Math.max(0, refs.pendingTurns.current - 1);
}

/**
 * Handles custom events that are processed before the generic handleLessonEvent.
 * Returns true if the event was fully handled (caller should return early).
 */
export function handleCustomEvent(
  event: string,
  data: LessonEventData,
  refs: LessonRefs,
  setState: SetLessonState,
  log: Log,
): boolean {
  switch (event) {
    case "lesson_started":
      handleLessonStarted(data, refs, setState);
      return false; // also processed by handleLessonEvent
    case "lesson_resumed":
      handleLessonResumed(data, refs, setState);
      return true;
    case "tutor_emotion":
      handleTutorEmotion(data, refs);
      return true;
    case "vocab_highlight":
      handleVocabHighlight(data, refs, setState, log);
      return true;
    case "vocab_reviewed":
      return true;
    case "speed_updated":
      handleSpeedUpdated(data, refs, log);
      return true;
    case "exercise":
      handleExercise(data, setState);
      return true;
    case "exercise_feedback":
      handleExerciseFeedback(data, refs, setState);
      return true;
    default:
      return false;
  }
}
