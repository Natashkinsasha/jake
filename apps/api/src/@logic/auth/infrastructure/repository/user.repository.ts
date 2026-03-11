import { Injectable } from "@nestjs/common";
import type { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";
import { eq } from "drizzle-orm";
import type { UserEntity, UserWithPreferences } from "../../domain/entity/user.entity";
import { UserFactory } from "../factory/user.factory";
import type { InsertUser } from "../model/insert-user";
import { userTable } from "../table/user.table";
import { userPreferenceTable } from "../table/user-preference.table";

@Injectable()
export class UserRepository {
  constructor(
    private readonly txHost: AppDrizzleTransactionHost<{
      user: typeof userTable;
      userPreference: typeof userPreferenceTable;
    }>,
  ) {}

  async findByGoogleId(googleId: string): Promise<UserEntity | null> {
    const [row] = await this.txHost.tx.select().from(userTable).where(eq(userTable.googleId, googleId)).limit(1);
    return row ? UserFactory.create(row) : null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const [row] = await this.txHost.tx.select().from(userTable).where(eq(userTable.id, id)).limit(1);
    return row ? UserFactory.create(row) : null;
  }

  async findByIdWithPreferences(id: string): Promise<UserWithPreferences | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(userTable)
      .leftJoin(userPreferenceTable, eq(userTable.id, userPreferenceTable.userId))
      .where(eq(userTable.id, id))
      .limit(1);
    return row ? UserFactory.createWithPreferences(row) : null;
  }

  async create(data: InsertUser): Promise<UserEntity> {
    const [user] = await this.txHost.tx.insert(userTable).values(data).returning();
    if (!user) {
      throw new Error("INSERT into users did not return a row");
    }
    await this.txHost.tx.insert(userPreferenceTable).values({ userId: user.id });
    return UserFactory.create(user);
  }

  async updateLevel(id: string, level: string): Promise<void> {
    await this.txHost.tx
      .update(userTable)
      .set({ currentLevel: level, updatedAt: new Date() })
      .where(eq(userTable.id, id));
  }

  async completeOnboarding(id: string, level: string): Promise<void> {
    await this.txHost.tx
      .update(userTable)
      .set({ onboardingCompleted: true, currentLevel: level, updatedAt: new Date() })
      .where(eq(userTable.id, id));
  }

  async resetUserFields(id: string): Promise<void> {
    await this.txHost.tx
      .update(userTable)
      .set({
        currentLevel: null,
        onboardingCompleted: false,
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, id));

    await this.txHost.tx
      .update(userPreferenceTable)
      .set({
        correctionStyle: "immediate",
        explainGrammar: true,
        speakingSpeed: "very_slow",
        useNativeLanguage: false,
        preferredExerciseTypes: [],
        interests: [],
        tutorGender: null,
        tutorNationality: null,
        tutorVoiceId: null,
        updatedAt: new Date(),
      })
      .where(eq(userPreferenceTable.userId, id));
  }

  async updatePreferences(
    userId: string,
    data: Partial<{
      correctionStyle: string;
      explainGrammar: boolean;
      speakingSpeed: string;
      useNativeLanguage: boolean;
      preferredExerciseTypes: string[];
      interests: string[];
      ttsModel: string;
      tutorGender: string;
      tutorNationality: string;
      tutorVoiceId: string;
    }>,
  ): Promise<void> {
    await this.txHost.tx.update(userPreferenceTable).set(data).where(eq(userPreferenceTable.userId, userId));
  }
}
