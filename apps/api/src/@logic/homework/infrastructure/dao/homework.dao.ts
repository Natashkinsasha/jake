import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-cls/app-drizzle-transaction-host";
import { eq } from "drizzle-orm";
import { homeworkTable } from "../table/homework.table";

@Injectable()
export class HomeworkDao {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ homework: typeof homeworkTable }>) {}

  async create(data: typeof homeworkTable.$inferInsert) {
    const [hw] = await this.txHost.tx.insert(homeworkTable).values(data).returning();
    return hw;
  }

  async findById(id: string) {
    const [hw] = await this.txHost.tx
      .select()
      .from(homeworkTable)
      .where(eq(homeworkTable.id, id))
      .limit(1);
    return hw ?? null;
  }

  async findByUser(userId: string) {
    return this.txHost.tx
      .select()
      .from(homeworkTable)
      .where(eq(homeworkTable.userId, userId));
  }

  async complete(id: string, score: number) {
    await this.txHost.tx
      .update(homeworkTable)
      .set({ completedAt: new Date(), score })
      .where(eq(homeworkTable.id, id));
  }
}
