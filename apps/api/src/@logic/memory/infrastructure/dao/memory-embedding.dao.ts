import { Inject, Injectable } from "@nestjs/common";
import { eq, desc } from "drizzle-orm";
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
}
