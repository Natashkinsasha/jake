import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../../@shared/shared-drizzle-pg/drizzle.provider";
import { homeworkTable } from "../table/homework.table";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class HomeworkDao {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

  async create(data: typeof homeworkTable.$inferInsert) {
    const [hw] = await this.db.insert(homeworkTable).values(data).returning();
    return hw;
  }

  async findById(id: string) {
    const [hw] = await this.db
      .select()
      .from(homeworkTable)
      .where(eq(homeworkTable.id, id))
      .limit(1);
    return hw ?? null;
  }

  async findByUser(userId: string) {
    return this.db
      .select()
      .from(homeworkTable)
      .where(eq(homeworkTable.userId, userId));
  }

  async complete(id: string, score: number) {
    await this.db
      .update(homeworkTable)
      .set({ completedAt: new Date(), score })
      .where(eq(homeworkTable.id, id));
  }
}
