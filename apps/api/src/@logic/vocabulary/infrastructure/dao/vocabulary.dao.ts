import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-cls/app-drizzle-transaction-host";
import { eq, desc, lte, and } from "drizzle-orm";
import { vocabularyTable } from "../table/vocabulary.table";

@Injectable()
export class VocabularyDao {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ vocabulary: typeof vocabularyTable }>) {}

  async upsert(data: { userId: string; word: string; lessonId: string; strength: number; nextReview: Date }) {
    const existing = await this.txHost.tx
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
      await this.txHost.tx
        .update(vocabularyTable)
        .set({ strength: data.strength, nextReview: data.nextReview, updatedAt: new Date() })
        .where(eq(vocabularyTable.id, existing[0].id));
      return existing[0];
    }

    const [vocab] = await this.txHost.tx.insert(vocabularyTable).values(data).returning();
    return vocab;
  }

  async findByUser(userId: string) {
    return this.txHost.tx
      .select()
      .from(vocabularyTable)
      .where(eq(vocabularyTable.userId, userId))
      .orderBy(desc(vocabularyTable.createdAt));
  }

  async findRecentByUser(userId: string, limit = 20) {
    return this.txHost.tx
      .select()
      .from(vocabularyTable)
      .where(eq(vocabularyTable.userId, userId))
      .orderBy(desc(vocabularyTable.createdAt))
      .limit(limit);
  }

  async findDueForReview(userId: string) {
    return this.txHost.tx
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
