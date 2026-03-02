import { createInsertSchema } from "drizzle-zod";
import { memoryFactTable } from "../table/memory-fact.table";

export const insertMemoryFactSchema = createInsertSchema(memoryFactTable);
export type InsertMemoryFact = typeof memoryFactTable.$inferInsert;
