import { type z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { vocabularyTable } from "../table/vocabulary.table";

export const insertVocabularySchema = createInsertSchema(vocabularyTable);
export type InsertVocabulary = z.infer<typeof insertVocabularySchema>;
