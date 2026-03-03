import { type z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { homeworkTable } from "../table/homework.table";

export const insertHomeworkSchema = createInsertSchema(homeworkTable);
export type InsertHomework = z.infer<typeof insertHomeworkSchema>;
