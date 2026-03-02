import { Inject, Injectable } from "@nestjs/common";
import { eq, and, desc } from "drizzle-orm";
import { DRIZZLE } from "../../../../@shared/shared-drizzle-pg/drizzle.provider";
import { memoryFactTable } from "../table/memory-fact.table";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class MemoryFactDao {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

  async create(data: typeof memoryFactTable.$inferInsert) {
    const [fact] = await this.db.insert(memoryFactTable).values(data).returning();
    return fact;
  }

  async findActiveByUser(userId: string, limit = 50) {
    return this.db
      .select()
      .from(memoryFactTable)
      .where(
        and(
          eq(memoryFactTable.userId, userId),
          eq(memoryFactTable.isActive, true),
        ),
      )
      .orderBy(desc(memoryFactTable.createdAt))
      .limit(limit);
  }
}
