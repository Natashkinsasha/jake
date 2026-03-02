import { Inject, Injectable } from "@nestjs/common";
import { eq, desc, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../../@shared/shared-drizzle-pg/drizzle.provider";
import { memoryEmbeddingTable } from "../table/memory-embedding.table";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class MemoryEmbeddingDao {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

  async create(data: typeof memoryEmbeddingTable.$inferInsert) {
    const [embedding] = await this.db.insert(memoryEmbeddingTable).values(data).returning();
    return embedding;
  }

  async findRecentByUser(userId: string, limit = 5) {
    return this.db
      .select()
      .from(memoryEmbeddingTable)
      .where(eq(memoryEmbeddingTable.userId, userId))
      .orderBy(desc(memoryEmbeddingTable.createdAt))
      .limit(limit);
  }

  async findSimilar(userId: string, queryEmbedding: number[], limit = 5, threshold = 0.8) {
    const vectorStr = `[${queryEmbedding.join(",")}]`;
    const results = await this.db.execute(
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
