import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-cls/app-drizzle-transaction-host";
import { eq, and, desc } from "drizzle-orm";
import { memoryFactTable } from "../table/memory-fact.table";
import { MemoryFactEntity } from "../../domain/entity/memory-fact.entity";
import { MemoryFactFactory } from "../factory/memory-fact.factory";

@Injectable()
export class MemoryFactRepository {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ memoryFact: typeof memoryFactTable }>) {}

  async create(data: typeof memoryFactTable.$inferInsert): Promise<MemoryFactEntity> {
    const [row] = await this.txHost.tx.insert(memoryFactTable).values(data).returning();
    return MemoryFactFactory.create(row);
  }

  async findActiveByUser(userId: string, limit = 50): Promise<MemoryFactEntity[]> {
    const rows = await this.txHost.tx
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
    return MemoryFactFactory.createMany(rows);
  }
}
