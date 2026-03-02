import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { memoryEmbeddingTable } from "../table/memory-embedding.table";

export const insertMemoryEmbeddingSchema = createInsertSchema(memoryEmbeddingTable);
export type InsertMemoryEmbedding = z.infer<typeof insertMemoryEmbeddingSchema>;
