import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";
import { lessonTable } from "../table/lesson.table";

export const selectLessonSchema = createSelectSchema(lessonTable);
export type SelectLesson = z.infer<typeof selectLessonSchema>;
