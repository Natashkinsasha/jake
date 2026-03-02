import { createSelectSchema } from "drizzle-zod";
import { vocabularyTable } from "../table/vocabulary.table";

export const selectVocabularySchema = createSelectSchema(vocabularyTable);
export type SelectVocabulary = typeof vocabularyTable.$inferSelect;
