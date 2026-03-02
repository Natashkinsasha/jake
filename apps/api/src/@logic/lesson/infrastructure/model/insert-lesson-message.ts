import { createInsertSchema } from "drizzle-zod";
import { lessonMessageTable } from "../table/lesson-message.table";

export const insertLessonMessageSchema = createInsertSchema(lessonMessageTable);
export type InsertLessonMessage = typeof lessonMessageTable.$inferInsert;
