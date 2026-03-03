import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";
import { eq } from "drizzle-orm";
import { tutorTable } from "../table/tutor.table";
import { TutorEntity } from "../../domain/entity/tutor.entity";
import { TutorFactory } from "../factory/tutor.factory";

@Injectable()
export class TutorRepository {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ tutor: typeof tutorTable }>) {}

  async findActive(): Promise<TutorEntity[]> {
    const rows = await this.txHost.tx
      .select()
      .from(tutorTable)
      .where(eq(tutorTable.isActive, true));
    return TutorFactory.createMany(rows);
  }

  async findById(id: string): Promise<TutorEntity | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(tutorTable)
      .where(eq(tutorTable.id, id))
      .limit(1);
    return row ? TutorFactory.create(row) : null;
  }
}
