import { type lessonMessageTable } from "../../infrastructure/table/lesson-message.table";

export type LessonMessageEntity = typeof lessonMessageTable.$inferSelect;
