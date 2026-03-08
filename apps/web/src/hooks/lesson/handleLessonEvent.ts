export interface LessonEventData {
  lessonId?: string;
  text?: string;
  state?: string;
  message?: string;
  chunkIndex?: number;
  fullText?: string;
  messageId?: string;
  discarded?: boolean;
}

interface EventContext {
  userSpeaking: boolean;
  pendingTurns: number;
}

export type LessonAction =
  | { type: "set_state"; patch: Record<string, unknown> }
  | { type: "show_message"; text: string; status: string }
  | { type: "stream_chunk"; chunkIndex: number; text: string; messageId?: string }
  | { type: "stream_end"; fullText: string; messageId?: string }
  | { type: "stream_discard" }
  | { type: "show_exercise"; exercise: { exerciseId: string; type: string; pairs: Array<{ word: string; definition: string }> } }
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
      return {
        type: "show_message",
        text: data.text ?? "",
        status: "idle",
      };
    }

    case "transcript":
      return {
        type: "show_message",
        text: data.text ?? "",
        status: "transcript",
      };

    case "exercise_feedback": {
      const shouldDiscardFb = ctx.userSpeaking || ctx.pendingTurns > 1;
      if (shouldDiscardFb) return { type: "discard" };
      return {
        type: "show_message",
        text: data.text ?? "",
        status: "idle",
      };
    }

    case "tutor_chunk": {
      if (ctx.userSpeaking) return { type: "discard" };
      return {
        type: "stream_chunk",
        chunkIndex: data.chunkIndex ?? 0,
        text: data.text ?? "",
        messageId: data.messageId,
      };
    }

    case "tutor_stream_end":
      if (data.discarded) {
        return { type: "stream_discard" };
      }
      return {
        type: "stream_end",
        fullText: data.fullText ?? "",
        messageId: data.messageId,
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

    case "exercise": {
      const d = data as LessonEventData & { exerciseId?: string; type?: string; pairs?: Array<{ word: string; definition: string }> };
      if (d.exerciseId && d.type && d.pairs) {
        return { type: "show_exercise", exercise: { exerciseId: d.exerciseId, type: d.type, pairs: d.pairs } };
      }
      return { type: "discard" };
    }

    default:
      return { type: "discard" };
  }
}
