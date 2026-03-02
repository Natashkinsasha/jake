import { createSelectSchema } from "drizzle-zod";
import { lessonTable } from "../table/lesson.table";

export const selectLessonSchema = createSelectSchema(lessonTable);
export type SelectLesson = typeof lessonTable.$inferSelect;
