import { Injectable } from "@nestjs/common";
import type { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";
import { eq } from "drizzle-orm";
import type { LessonMessageEntity } from "../../domain/entity/lesson-message.entity";
import { LessonMessageFactory } from "../factory/lesson-message.factory";
import { lessonMessageTable } from "../table/lesson-message.table";

@Injectable()
export class LessonMessageRepository {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ lessonMessage: typeof lessonMessageTable }>) {}

  async create(data: typeof lessonMessageTable.$inferInsert): Promise<LessonMessageEntity> {
    const [row] = await this.txHost.tx.insert(lessonMessageTable).values(data).returning();
    if (!row) throw new Error("INSERT into lesson_messages did not return a row");
    return LessonMessageFactory.create(row);
  }

  async findByLesson(lessonId: string): Promise<LessonMessageEntity[]> {
    const rows = await this.txHost.tx
      .select()
      .from(lessonMessageTable)
      .where(eq(lessonMessageTable.lessonId, lessonId))
      .orderBy(lessonMessageTable.timestamp);
    return LessonMessageFactory.createMany(rows);
  }
}
