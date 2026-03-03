import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";
import { eq, desc, sql } from "drizzle-orm";
import { memoryEmbeddingTable } from "../table/memory-embedding.table";
import { MemoryEmbeddingEntity } from "../../domain/entity/memory-embedding.entity";
import { MemoryEmbeddingFactory } from "../factory/memory-embedding.factory";

export interface EmbeddingSimilarityResult {
  id: string;
  content: string;
  emotional_tone: string;
  created_at: Date;
  similarity: number;
}

@Injectable()
export class MemoryEmbeddingRepository {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ memoryEmbedding: typeof memoryEmbeddingTable }>) {}

  async create(data: typeof memoryEmbeddingTable.$inferInsert): Promise<MemoryEmbeddingEntity> {
    const [row] = await this.txHost.tx.insert(memoryEmbeddingTable).values(data).returning();
    if (!row) throw new Error("INSERT into memory_embeddings did not return a row");
    return MemoryEmbeddingFactory.create(row);
  }

  async findRecentByUser(userId: string, limit = 5): Promise<MemoryEmbeddingEntity[]> {
    const rows = await this.txHost.tx
      .select()
      .from(memoryEmbeddingTable)
      .where(eq(memoryEmbeddingTable.userId, userId))
      .orderBy(desc(memoryEmbeddingTable.createdAt))
      .limit(limit);
    return MemoryEmbeddingFactory.createMany(rows);
  }

  async findSimilar(userId: string, queryEmbedding: number[], limit = 5, threshold = 0.8): Promise<EmbeddingSimilarityResult[]> {
    const vectorStr = `[${queryEmbedding.join(",")}]`;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- raw SQL query returns untyped result
    const results = await this.txHost.tx.execute(
      sql`SELECT id, content, emotional_tone, created_at,
          1 - (embedding <=> ${vectorStr}::vector) as similarity
        FROM memory_embeddings
        WHERE user_id = ${userId}
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${vectorStr}::vector) > ${threshold}
        ORDER BY similarity DESC
        LIMIT ${limit}`
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- raw SQL result structure
    return ((results as Record<string, unknown>)["rows"] ?? results) as EmbeddingSimilarityResult[];
  }
}
