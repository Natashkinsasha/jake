import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod";
import { memoryFactTable } from "../table/memory-fact.table";

export const insertMemoryFactSchema = createInsertSchema(memoryFactTable);
export type InsertMemoryFact = z.infer<typeof insertMemoryFactSchema>;
