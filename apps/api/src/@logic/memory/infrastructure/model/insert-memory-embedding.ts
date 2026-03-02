import { createInsertSchema } from "drizzle-zod";
import { memoryEmbeddingTable } from "../table/memory-embedding.table";

export const insertMemoryEmbeddingSchema = createInsertSchema(memoryEmbeddingTable);
export type InsertMemoryEmbedding = typeof memoryEmbeddingTable.$inferInsert;
