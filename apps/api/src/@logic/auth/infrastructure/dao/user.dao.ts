import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../../@shared/shared-drizzle-pg/drizzle.provider";
import { userTable } from "../table/user.table";
import { userPreferenceTable } from "../table/user-preference.table";
import { InsertUser } from "../model/insert-user";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class UserDao {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

  async findByGoogleId(googleId: string) {
    const [user] = await this.db
      .select()
      .from(userTable)
      .where(eq(userTable.googleId, googleId))
      .limit(1);
    return user ?? null;
  }

  async findById(id: string) {
    const [user] = await this.db
      .select()
      .from(userTable)
      .where(eq(userTable.id, id))
      .limit(1);
    return user ?? null;
  }

  async findByIdWithPreferences(id: string) {
    const [result] = await this.db
      .select()
      .from(userTable)
      .leftJoin(userPreferenceTable, eq(userTable.id, userPreferenceTable.userId))
      .where(eq(userTable.id, id))
      .limit(1);
    return result ?? null;
  }

  async create(data: InsertUser) {
    const [user] = await this.db.insert(userTable).values(data).returning();
    await this.db.insert(userPreferenceTable).values({ userId: user.id });
    return user;
  }

  async updateLevel(id: string, level: string) {
    await this.db
      .update(userTable)
      .set({ currentLevel: level, updatedAt: new Date() })
      .where(eq(userTable.id, id));
  }
}
