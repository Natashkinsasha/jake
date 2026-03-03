import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-cls/app-drizzle-transaction-host";
import { eq } from "drizzle-orm";
import { lessonMessageTable } from "../table/lesson-message.table";

@Injectable()
export class LessonMessageDao {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ lessonMessage: typeof lessonMessageTable }>) {}

  async create(data: typeof lessonMessageTable.$inferInsert) {
    const [msg] = await this.txHost.tx.insert(lessonMessageTable).values(data).returning();
    return msg;
  }

  async findByLesson(lessonId: string) {
    return this.txHost.tx
      .select()
      .from(lessonMessageTable)
      .where(eq(lessonMessageTable.lessonId, lessonId))
      .orderBy(lessonMessageTable.timestamp);
  }
}
