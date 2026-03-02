import { lessonTable } from "../table/lesson.table";
import { tutorTable } from "../../../tutor/infrastructure/table/tutor.table";

export type SelectLessonWithTutor = {
  lessons: typeof lessonTable.$inferSelect;
  tutors: typeof tutorTable.$inferSelect;
};
