import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";
import { eq, sql, desc } from "drizzle-orm";
import { lessonTable } from "../table/lesson.table";
import { lessonMessageTable } from "../table/lesson-message.table";
import { LessonEntity } from "../../domain/entity/lesson.entity";
import { LessonFactory } from "../factory/lesson.factory";

@Injectable()
export class LessonRepository {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ lesson: typeof lessonTable; lessonMessage: typeof lessonMessageTable }>) {}

  async create(data: typeof lessonTable.$inferInsert): Promise<LessonEntity> {
    const [row] = await this.txHost.tx.insert(lessonTable).values(data).returning();
    if (!row) throw new Error("INSERT into lessons did not return a row");
    return LessonFactory.create(row);
  }

  async createWithGreeting(
    lessonData: typeof lessonTable.$inferInsert,
    greeting: string,
  ): Promise<LessonEntity> {
    const lesson = await this.create(lessonData);
    await this.txHost.tx.insert(lessonMessageTable).values({
      lessonId: lesson.id,
      role: "tutor",
      content: greeting,
    });
    return lesson;
  }

  async findById(id: string): Promise<LessonEntity | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(lessonTable)
      .where(eq(lessonTable.id, id))
      .limit(1);
    return row ? LessonFactory.create(row) : null;
  }

  async countByUser(userId: string): Promise<number> {
    const [result] = await this.txHost.tx
      .select({ count: sql<number>`count(*)::int` })
      .from(lessonTable)
      .where(eq(lessonTable.userId, userId));
    return result?.count ?? 0;
  }

  async findRecentByUser(userId: string, limit = 10, offset = 0): Promise<LessonEntity[]> {
    const rows = await this.txHost.tx
      .select()
      .from(lessonTable)
      .where(eq(lessonTable.userId, userId))
      .orderBy(desc(lessonTable.startedAt))
      .limit(limit)
      .offset(offset);
    return LessonFactory.createMany(rows);
  }

  async complete(id: string, data: Partial<typeof lessonTable.$inferInsert>): Promise<void> {
    await this.txHost.tx
      .update(lessonTable)
      .set({ ...data, status: "completed", endedAt: new Date() })
      .where(eq(lessonTable.id, id));
  }
}
