import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-cls/app-drizzle-transaction-host";
import { eq } from "drizzle-orm";
import { userTable } from "../table/user.table";
import { userPreferenceTable } from "../table/user-preference.table";
import { InsertUser } from "../model/insert-user";

@Injectable()
export class UserDao {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ user: typeof userTable; userPreference: typeof userPreferenceTable }>) {}

  async findByGoogleId(googleId: string) {
    const [user] = await this.txHost.tx
      .select()
      .from(userTable)
      .where(eq(userTable.googleId, googleId))
      .limit(1);
    return user ?? null;
  }

  async findById(id: string) {
    const [user] = await this.txHost.tx
      .select()
      .from(userTable)
      .where(eq(userTable.id, id))
      .limit(1);
    return user ?? null;
  }

  async findByIdWithPreferences(id: string) {
    const [result] = await this.txHost.tx
      .select()
      .from(userTable)
      .leftJoin(userPreferenceTable, eq(userTable.id, userPreferenceTable.userId))
      .where(eq(userTable.id, id))
      .limit(1);
    return result ?? null;
  }

  async create(data: InsertUser) {
    const [user] = await this.txHost.tx.insert(userTable).values(data).returning();
    await this.txHost.tx.insert(userPreferenceTable).values({ userId: user.id });
    return user;
  }

  async updateLevel(id: string, level: string) {
    await this.txHost.tx
      .update(userTable)
      .set({ currentLevel: level, updatedAt: new Date() })
      .where(eq(userTable.id, id));
  }

  async updatePreferences(userId: string, data: Partial<{
    correctionStyle: string;
    explainGrammar: boolean;
    speakingSpeed: string;
    useNativeLanguage: boolean;
    preferredExerciseTypes: string[];
    interests: string[];
  }>): Promise<void> {
    await this.txHost.tx.update(userPreferenceTable).set(data).where(eq(userPreferenceTable.userId, userId));
  }
}
