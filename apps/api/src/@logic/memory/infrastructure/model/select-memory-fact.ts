import { type z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { memoryFactTable } from "../table/memory-fact.table";

export const selectMemoryFactSchema = createSelectSchema(memoryFactTable);
export type SelectMemoryFact = z.infer<typeof selectMemoryFactSchema>;
