export interface WsLessonEvent {
  type: "lesson_started" | "tutor_message" | "transcript" | "exercise_feedback" | "lesson_ended" | "status" | "error";
  data: any;
}
