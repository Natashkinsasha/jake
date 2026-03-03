import type { LessonExercise } from "@/types";

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
  | { type: "discard" };

export function handleLessonEvent(
  event: string,
  data: any,
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
            text: data.text,
            audio: data.audio,
            exercise: data.exercise || null,
          },
        };
      }
      return {
        type: "show_message",
        text: data.text,
        exercise: data.exercise || null,
        status: "idle",
      };
    }

    case "transcript":
      return {
        type: "show_message",
        text: data.text,
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
          pending: { text: data.text, exercise: null },
        };
      }
      return {
        type: "show_message",
        text: data.text,
        exercise: null,
        status: "idle",
      };
    }

    case "status":
      return {
        type: "set_state",
        patch: { status: data.state === "thinking" ? "thinking" : undefined },
      };

    case "lesson_ended":
      return { type: "set_state", patch: { status: "idle", lessonEnded: true } };

    case "error":
      return { type: "set_state", patch: { status: "idle" } };

    default:
      return { type: "discard" };
  }
}
