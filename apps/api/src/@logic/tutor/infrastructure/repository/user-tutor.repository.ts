import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-cls/app-drizzle-transaction-host";
import { eq, and } from "drizzle-orm";
import { userTutorTable } from "../table/user-tutor.table";
import { tutorTable } from "../table/tutor.table";
import { UserTutorEntity, UserTutorWithTutor } from "../../domain/entity/user-tutor.entity";
import { UserTutorFactory } from "../factory/user-tutor.factory";

@Injectable()
export class UserTutorRepository {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ userTutor: typeof userTutorTable; tutor: typeof tutorTable }>) {}

  async findActiveByUser(userId: string): Promise<UserTutorWithTutor | null> {
    const [row] = await this.txHost.tx
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
    return row ? UserTutorFactory.createWithTutor(row) : null;
  }

  async selectTutor(userId: string, tutorId: string): Promise<UserTutorEntity> {
    await this.txHost.tx
      .update(userTutorTable)
      .set({ isActive: false })
      .where(
        and(
          eq(userTutorTable.userId, userId),
          eq(userTutorTable.isActive, true),
        ),
      );

    const [result] = await this.txHost.tx
      .insert(userTutorTable)
      .values({ userId, tutorId, isActive: true })
      .returning();
    return UserTutorFactory.create(result);
  }
}
