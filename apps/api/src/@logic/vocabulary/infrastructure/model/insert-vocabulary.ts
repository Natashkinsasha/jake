import { createInsertSchema } from "drizzle-zod";
import { vocabularyTable } from "../table/vocabulary.table";

export const insertVocabularySchema = createInsertSchema(vocabularyTable);
export type InsertVocabulary = typeof vocabularyTable.$inferInsert;
