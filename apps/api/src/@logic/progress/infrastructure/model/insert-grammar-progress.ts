import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod";
import { grammarProgressTable } from "../table/grammar-progress.table";

export const insertGrammarProgressSchema = createInsertSchema(grammarProgressTable);
export type InsertGrammarProgress = z.infer<typeof insertGrammarProgressSchema>;
