import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-cls/app-drizzle-transaction-host";
import { eq, and, desc } from "drizzle-orm";
import { memoryFactTable } from "../table/memory-fact.table";

@Injectable()
export class MemoryFactDao {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ memoryFact: typeof memoryFactTable }>) {}

  async create(data: typeof memoryFactTable.$inferInsert) {
    const [fact] = await this.txHost.tx.insert(memoryFactTable).values(data).returning();
    return fact;
  }

  async findActiveByUser(userId: string, limit = 50) {
    return this.txHost.tx
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
