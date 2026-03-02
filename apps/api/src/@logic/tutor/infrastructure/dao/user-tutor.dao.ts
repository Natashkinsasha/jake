import { Inject, Injectable } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { DRIZZLE } from "../../../../@shared/shared-drizzle-pg/drizzle.provider";
import { userTutorTable } from "../table/user-tutor.table";
import { tutorTable } from "../table/tutor.table";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class UserTutorDao {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

  async findActiveByUser(userId: string) {
    const [result] = await this.db
      .select()
      .from(userTutorTable)
      .innerJoin(tutorTable, eq(userTutorTable.tutorId, tutorTable.id))
      .where(
        and(
          eq(userTutorTable.userId, userId),
          eq(userTutorTable.isActive, true),
        ),
      )
      .limit(1);
    return result ?? null;
  }

  async selectTutor(userId: string, tutorId: string) {
    // Деактивируем текущего
    await this.db
      .update(userTutorTable)
      .set({ isActive: false })
      .where(
        and(
          eq(userTutorTable.userId, userId),
          eq(userTutorTable.isActive, true),
        ),
      );

    // Активируем нового
    const [result] = await this.db
      .insert(userTutorTable)
      .values({ userId, tutorId, isActive: true })
      .returning();
    return result;
  }
}
