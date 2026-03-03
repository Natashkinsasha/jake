import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-cls/app-drizzle-transaction-host";
import { eq, desc, sql } from "drizzle-orm";
import { memoryEmbeddingTable } from "../table/memory-embedding.table";

@Injectable()
export class MemoryEmbeddingDao {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ memoryEmbedding: typeof memoryEmbeddingTable }>) {}

  async create(data: typeof memoryEmbeddingTable.$inferInsert) {
    const [embedding] = await this.txHost.tx.insert(memoryEmbeddingTable).values(data).returning();
    return embedding;
  }

  async findRecentByUser(userId: string, limit = 5) {
    return this.txHost.tx
      .select()
      .from(memoryEmbeddingTable)
      .where(eq(memoryEmbeddingTable.userId, userId))
      .orderBy(desc(memoryEmbeddingTable.createdAt))
      .limit(limit);
  }

  async findSimilar(userId: string, queryEmbedding: number[], limit = 5, threshold = 0.8) {
    const vectorStr = `[${queryEmbedding.join(",")}]`;
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
    return results as any[];
  }
}
