import { type vocabularyTable } from "../../infrastructure/table/vocabulary.table";

export type VocabularyEntity = typeof vocabularyTable.$inferSelect;
