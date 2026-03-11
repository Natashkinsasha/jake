import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod";
import { lessonMessageTable } from "../table/lesson-message.table";

export const insertLessonMessageSchema = createInsertSchema(lessonMessageTable);
export type InsertLessonMessage = z.infer<typeof insertLessonMessageSchema>;
