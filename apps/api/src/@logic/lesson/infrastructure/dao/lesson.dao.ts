import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-cls/app-drizzle-transaction-host";
import { eq, sql, desc } from "drizzle-orm";
import { lessonTable } from "../table/lesson.table";

@Injectable()
export class LessonDao {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ lesson: typeof lessonTable }>) {}

  async create(data: typeof lessonTable.$inferInsert) {
    const [lesson] = await this.txHost.tx.insert(lessonTable).values(data).returning();
    return lesson;
  }

  async findById(id: string) {
    const [lesson] = await this.txHost.tx
      .select()
      .from(lessonTable)
      .where(eq(lessonTable.id, id))
      .limit(1);
    return lesson ?? null;
  }

  async countByUser(userId: string): Promise<number> {
    const [result] = await this.txHost.tx
      .select({ count: sql<number>`count(*)::int` })
      .from(lessonTable)
      .where(eq(lessonTable.userId, userId));
    return result.count;
  }

  async findRecentByUser(userId: string, limit = 10) {
    return this.txHost.tx
      .select()
      .from(lessonTable)
      .where(eq(lessonTable.userId, userId))
      .orderBy(desc(lessonTable.startedAt))
      .limit(limit);
  }

  async complete(id: string, data: Partial<typeof lessonTable.$inferInsert>) {
    await this.txHost.tx
      .update(lessonTable)
      .set({ ...data, status: "completed", endedAt: new Date() })
      .where(eq(lessonTable.id, id));
  }
}
