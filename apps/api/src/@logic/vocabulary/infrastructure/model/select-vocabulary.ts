import { type z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { vocabularyTable } from "../table/vocabulary.table";

export const selectVocabularySchema = createSelectSchema(vocabularyTable);
export type SelectVocabulary = z.infer<typeof selectVocabularySchema>;
