import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { tutorTable } from "../table/tutor.table";

export const selectTutorSchema = createSelectSchema(tutorTable);
export type SelectTutor = z.infer<typeof selectTutorSchema>;
