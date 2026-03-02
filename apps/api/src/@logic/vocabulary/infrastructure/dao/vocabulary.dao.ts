import { Inject, Injectable } from "@nestjs/common";
import { eq, desc, lte, and, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../../@shared/shared-drizzle-pg/drizzle.provider";
import { vocabularyTable } from "../table/vocabulary.table";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class VocabularyDao {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

  async upsert(data: { userId: string; word: string; lessonId: string; strength: number; nextReview: Date }) {
    const existing = await this.db
      .select()
      .from(vocabularyTable)
      .where(
        and(
          eq(vocabularyTable.userId, data.userId),
          eq(vocabularyTable.word, data.word),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(vocabularyTable)
        .set({ strength: data.strength, nextReview: data.nextReview, updatedAt: new Date() })
        .where(eq(vocabularyTable.id, existing[0].id));
      return existing[0];
    }

    const [vocab] = await this.db.insert(vocabularyTable).values(data).returning();
    return vocab;
  }

  async findByUser(userId: string) {
    return this.db
      .select()
      .from(vocabularyTable)
      .where(eq(vocabularyTable.userId, userId))
      .orderBy(desc(vocabularyTable.createdAt));
  }

  async findRecentByUser(userId: string, limit = 20) {
    return this.db
      .select()
      .from(vocabularyTable)
      .where(eq(vocabularyTable.userId, userId))
      .orderBy(desc(vocabularyTable.createdAt))
      .limit(limit);
  }

  async findDueForReview(userId: string) {
    return this.db
      .select()
      .from(vocabularyTable)
      .where(
        and(
          eq(vocabularyTable.userId, userId),
          lte(vocabularyTable.nextReview, new Date()),
        ),
      )
      .orderBy(vocabularyTable.nextReview);
  }
}
