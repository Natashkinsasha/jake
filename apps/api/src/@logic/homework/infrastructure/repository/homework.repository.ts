import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";
import { eq } from "drizzle-orm";
import { homeworkTable } from "../table/homework.table";
import { HomeworkEntity } from "../../domain/entity/homework.entity";
import { HomeworkFactory } from "../factory/homework.factory";

@Injectable()
export class HomeworkRepository {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ homework: typeof homeworkTable }>) {}

  async create(data: typeof homeworkTable.$inferInsert): Promise<HomeworkEntity> {
    const [row] = await this.txHost.tx.insert(homeworkTable).values(data).returning();
    if (!row) throw new Error("INSERT into homework did not return a row");
    return HomeworkFactory.create(row);
  }

  async findById(id: string): Promise<HomeworkEntity | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(homeworkTable)
      .where(eq(homeworkTable.id, id))
      .limit(1);
    return row ? HomeworkFactory.create(row) : null;
  }

  async findByUser(userId: string): Promise<HomeworkEntity[]> {
    const rows = await this.txHost.tx
      .select()
      .from(homeworkTable)
      .where(eq(homeworkTable.userId, userId));
    return HomeworkFactory.createMany(rows);
  }

  async complete(id: string, score: number): Promise<void> {
    await this.txHost.tx
      .update(homeworkTable)
      .set({ completedAt: new Date(), score })
      .where(eq(homeworkTable.id, id));
  }
}
