import { Inject, Injectable } from "@nestjs/common";
import { eq, sql, desc } from "drizzle-orm";
import { DRIZZLE } from "../../../../@shared/shared-drizzle-pg/drizzle.provider";
import { lessonTable } from "../table/lesson.table";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class LessonDao {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

  async create(data: typeof lessonTable.$inferInsert) {
    const [lesson] = await this.db.insert(lessonTable).values(data).returning();
    return lesson;
  }

  async findById(id: string) {
    const [lesson] = await this.db
      .select()
      .from(lessonTable)
      .where(eq(lessonTable.id, id))
      .limit(1);
    return lesson ?? null;
  }

  async countByUser(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(lessonTable)
      .where(eq(lessonTable.userId, userId));
    return result.count;
  }

  async findRecentByUser(userId: string, limit = 10) {
    return this.db
      .select()
      .from(lessonTable)
      .where(eq(lessonTable.userId, userId))
      .orderBy(desc(lessonTable.startedAt))
      .limit(limit);
  }

  async complete(id: string, data: Partial<typeof lessonTable.$inferInsert>) {
    await this.db
      .update(lessonTable)
      .set({ ...data, status: "completed", endedAt: new Date() })
      .where(eq(lessonTable.id, id));
  }
}
