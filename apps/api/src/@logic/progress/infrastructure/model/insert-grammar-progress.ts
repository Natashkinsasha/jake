import { createInsertSchema } from "drizzle-zod";
import { grammarProgressTable } from "../table/grammar-progress.table";

export const insertGrammarProgressSchema = createInsertSchema(grammarProgressTable);
export type InsertGrammarProgress = typeof grammarProgressTable.$inferInsert;
