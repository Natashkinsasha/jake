import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";
import { eq, and, desc, or, isNull, gt } from "drizzle-orm";
import { memoryFactTable } from "../table/memory-fact.table";
import { MemoryFactEntity } from "../../domain/entity/memory-fact.entity";
import { MemoryFactFactory } from "../factory/memory-fact.factory";

@Injectable()
export class MemoryFactRepository {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ memoryFact: typeof memoryFactTable }>) {}

  async create(data: typeof memoryFactTable.$inferInsert): Promise<MemoryFactEntity> {
    const [row] = await this.txHost.tx.insert(memoryFactTable).values(data).returning();
    if (!row) throw new Error("INSERT into memory_facts did not return a row");
    return MemoryFactFactory.create(row);
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.txHost.tx.delete(memoryFactTable).where(eq(memoryFactTable.userId, userId));
  }

  async findActiveByUser(userId: string, limit = 50): Promise<MemoryFactEntity[]> {
    const rows = await this.txHost.tx
      .select()
      .from(memoryFactTable)
      .where(
        and(
          eq(memoryFactTable.userId, userId),
          eq(memoryFactTable.isActive, true),
          or(
            isNull(memoryFactTable.expiresAt),
            gt(memoryFactTable.expiresAt, new Date()),
          ),
        ),
      )
      .orderBy(desc(memoryFactTable.createdAt))
      .limit(limit);
    return MemoryFactFactory.createMany(rows);
  }
}
