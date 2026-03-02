import { createSelectSchema } from "drizzle-zod";
import { memoryFactTable } from "../table/memory-fact.table";

export const selectMemoryFactSchema = createSelectSchema(memoryFactTable);
export type SelectMemoryFact = typeof memoryFactTable.$inferSelect;
