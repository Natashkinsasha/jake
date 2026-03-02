import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../../@shared/shared-drizzle-pg/drizzle.provider";
import { tutorTable } from "../table/tutor.table";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class TutorDao {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

  async findActive() {
    return this.db
      .select()
      .from(tutorTable)
      .where(eq(tutorTable.isActive, true));
  }

  async findById(id: string) {
    const [tutor] = await this.db
      .select()
      .from(tutorTable)
      .where(eq(tutorTable.id, id))
      .limit(1);
    return tutor ?? null;
  }
}
