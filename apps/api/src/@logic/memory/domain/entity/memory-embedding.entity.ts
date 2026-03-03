import { memoryEmbeddingTable } from "../../infrastructure/table/memory-embedding.table";

export type MemoryEmbeddingEntity = typeof memoryEmbeddingTable.$inferSelect;
