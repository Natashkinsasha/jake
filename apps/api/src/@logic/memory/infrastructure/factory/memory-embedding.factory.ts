import { MemoryEmbeddingEntity } from "../../domain/entity/memory-embedding.entity";
import { memoryEmbeddingTable } from "../table/memory-embedding.table";

type MemoryEmbeddingRow = typeof memoryEmbeddingTable.$inferSelect;

export class MemoryEmbeddingFactory {
  static create(row: MemoryEmbeddingRow): MemoryEmbeddingEntity {
    return row;
  }

  static createMany(rows: MemoryEmbeddingRow[]): MemoryEmbeddingEntity[] {
    return rows.map(MemoryEmbeddingFactory.create);
  }
}
