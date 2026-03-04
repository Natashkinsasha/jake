import type { LessonExercise } from "@/types";

/**
 * Maps backend Exercise (from @jake/shared) to frontend LessonExercise format.
 * Backend stores exercise-specific data in `content: Record<string, unknown>`,
 * while frontend components expect flat structures (e.g. `sentence`, `options`).
 */
function mapExercise(raw: unknown): LessonExercise | null {
  if (raw === null || raw === undefined || typeof raw !== "object") return null;

  const ex = raw as Record<string, unknown>;
  const exType = ex["type"];
  const exId = ex["id"];
  if (exType === undefined || exType === null || exId === undefined || exId === null) return null;

  // If it already has flat fields (frontend format), return as-is
  if ("sentence" in ex || "question" in ex || "words" in ex) {
    return ex as unknown as LessonExercise;
  }

  const content = (ex["content"] ?? {}) as Record<string, unknown>;
  const hints = ex["hints"] as string[] | undefined;
  const hint = hints?.[0];
  const id = exId as string;

  switch (exType) {
    case "fill_the_gap":
      return { id, type: "fill_the_gap", sentence: String(content["sentence"] ?? ""), hint };
    case "multiple_choice":
      return { id, type: "multiple_choice", question: String(content["question"] ?? ""), options: Array.isArray(content["options"]) ? content["options"] as string[] : [], hint };
    case "sentence_builder":
      return { id, type: "sentence_builder", words: Array.isArray(content["words"]) ? content["words"] as string[] : [], hint };
    case "error_correction":
      return { id, type: "error_correction", sentence: String(content["sentence"] ?? ""), hint };
    default:
      return null;
  }
}

export interface LessonEventData {
  lessonId?: string;
  text?: string;
  audio?: string;
  exercise?: unknown;
  state?: string;
  message?: string;
  chunkIndex?: number;
  fullText?: string;
}

interface EventContext {
  userSpeaking: boolean;
  pendingTurns: number;
}

interface PendingMessage {
  text: string;
  audio?: string;
  exercise?: LessonExercise | null;
}

export type LessonAction =
  | { type: "set_state"; patch: Record<string, unknown> }
  | { type: "play_audio"; audio: string; pending: PendingMessage }
  | { type: "show_message"; text: string; exercise: LessonExercise | null; status: string }
  | { type: "stream_chunk"; chunkIndex: number; text: string; audio: string }
  | { type: "stream_end"; fullText: string; exercise: LessonExercise | null }
  | { type: "discard" };

export function handleLessonEvent(
  event: string,
  data: LessonEventData,
  ctx: EventContext,
): LessonAction {
  switch (event) {
    case "lesson_started":
      return { type: "set_state", patch: { lessonId: data.lessonId, status: "idle" } };

    case "tutor_message": {
      const shouldDiscard = ctx.userSpeaking || ctx.pendingTurns > 1;
      if (shouldDiscard) return { type: "discard" };

      if (data.audio) {
        return {
          type: "play_audio",
          audio: data.audio,
          pending: {
            text: data.text ?? "",
            audio: data.audio,
            exercise: mapExercise(data.exercise),
          },
        };
      }
      return {
        type: "show_message",
        text: data.text ?? "",
        exercise: mapExercise(data.exercise),
        status: "idle",
      };
    }

    case "transcript":
      return {
        type: "show_message",
        text: data.text ?? "",
        exercise: null,
        status: "transcript",
      };

    case "exercise_feedback": {
      const shouldDiscardFb = ctx.userSpeaking || ctx.pendingTurns > 1;
      if (shouldDiscardFb) return { type: "discard" };

      if (data.audio) {
        return {
          type: "play_audio",
          audio: data.audio,
          pending: { text: data.text ?? "", exercise: null },
        };
      }
      return {
        type: "show_message",
        text: data.text ?? "",
        exercise: null,
        status: "idle",
      };
    }

    case "tutor_chunk": {
      if (ctx.userSpeaking) return { type: "discard" };
      return {
        type: "stream_chunk",
        chunkIndex: data.chunkIndex ?? 0,
        text: data.text ?? "",
        audio: data.audio ?? "",
      };
    }

    case "tutor_stream_end":
      return {
        type: "stream_end",
        fullText: data.fullText ?? "",
        exercise: mapExercise(data.exercise),
      };

    case "status":
      return {
        type: "set_state",
        patch: { status: data.state === "thinking" ? "thinking" : undefined },
      };

    case "lesson_ended":
      return { type: "set_state", patch: { status: "idle", lessonEnded: true } };

    case "error":
      return { type: "set_state", patch: { status: "idle", error: data.message ?? "Something went wrong" } };

    default:
      return { type: "discard" };
  }
}
