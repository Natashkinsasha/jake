import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { grammarProgressTable } from "../table/grammar-progress.table";

export const selectGrammarProgressSchema = createSelectSchema(grammarProgressTable);
export type SelectGrammarProgress = z.infer<typeof selectGrammarProgressSchema>;
