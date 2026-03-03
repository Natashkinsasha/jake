import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-cls/app-drizzle-transaction-host";
import { eq } from "drizzle-orm";
import { lessonMessageTable } from "../table/lesson-message.table";
import { LessonMessageEntity } from "../../domain/entity/lesson-message.entity";
import { LessonMessageFactory } from "../factory/lesson-message.factory";

@Injectable()
export class LessonMessageRepository {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ lessonMessage: typeof lessonMessageTable }>) {}

  async create(data: typeof lessonMessageTable.$inferInsert): Promise<LessonMessageEntity> {
    const [row] = await this.txHost.tx.insert(lessonMessageTable).values(data).returning();
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
