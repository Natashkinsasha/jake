import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { lessonTable } from "../table/lesson.table";

export const selectLessonSchema = createSelectSchema(lessonTable);
export type SelectLesson = z.infer<typeof selectLessonSchema>;
