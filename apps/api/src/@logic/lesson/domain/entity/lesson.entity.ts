import { lessonTable } from "../../infrastructure/table/lesson.table";

export type LessonEntity = typeof lessonTable.$inferSelect;
