import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../../@shared/shared-drizzle-pg/drizzle.provider";
import { lessonMessageTable } from "../table/lesson-message.table";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class LessonMessageDao {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

  async create(data: typeof lessonMessageTable.$inferInsert) {
    const [msg] = await this.db.insert(lessonMessageTable).values(data).returning();
    return msg;
  }

  async findByLesson(lessonId: string) {
    return this.db
      .select()
      .from(lessonMessageTable)
      .where(eq(lessonMessageTable.lessonId, lessonId))
      .orderBy(lessonMessageTable.timestamp);
  }
}
