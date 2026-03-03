import { type z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { lessonTable } from "../table/lesson.table";

export const insertLessonSchema = createInsertSchema(lessonTable);
export type InsertLesson = z.infer<typeof insertLessonSchema>;
