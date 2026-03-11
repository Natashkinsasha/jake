import type { memoryFactTable } from "../../infrastructure/table/memory-fact.table";

export type MemoryFactEntity = typeof memoryFactTable.$inferSelect;
