import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { homeworkTable } from "../table/homework.table";

export const selectHomeworkSchema = createSelectSchema(homeworkTable);
export type SelectHomework = z.infer<typeof selectHomeworkSchema>;
