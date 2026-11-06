export interface LessonEventData {
  lessonId?: string;
  text?: string;
  state?: string;
  message?: string;
  chunkIndex?: number;
  fullText?: string;
  messageId?: string;
  discarded?: boolean;
  // error events: fatal ends the lesson screen, turn means the reply in flight failed
  fatal?: boolean;
  turn?: boolean;
}

interface EventContext {
  userSpeaking: boolean;
  awaitingReply: boolean;
}

export type LessonAction =
  | { type: "set_state"; patch: Record<string, unknown> }
  | { type: "show_message"; text: string; status: string }
  | { type: "stream_chunk"; chunkIndex: number; text: string; messageId?: string }
  | { type: "stream_end"; fullText: string; messageId?: string }
  | { type: "stream_discard" }
  | { type: "turn_error"; message: string; messageId?: string }
  | { type: "discard" };

export function handleLessonEvent(event: string, data: LessonEventData, ctx: EventContext): LessonAction {
  switch (event) {
    case "lesson_started":
      return { type: "set_state", patch: { lessonId: data.lessonId, status: "idle" } };

    case "tutor_message": {
      // A safety reply to a message the student has already followed up on is stale
      const shouldDiscard = ctx.userSpeaking || ctx.awaitingReply;
      if (shouldDiscard) {
        return { type: "discard" };
      }
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

    case "tutor_chunk": {
      if (ctx.userSpeaking) {
        return { type: "discard" };
      }
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

    case "error": {
      const message = data.message ?? "Something went wrong";
      if (data.fatal) {
        return { type: "set_state", patch: { status: "idle", error: message } };
      }
      if (data.turn) {
        return { type: "turn_error", message, messageId: data.messageId };
      }
      return { type: "set_state", patch: { notice: { message, at: Date.now() } } };
    }

    default:
      return { type: "discard" };
  }
}
