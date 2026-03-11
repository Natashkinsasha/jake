import { Injectable } from "@nestjs/common";
import type { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { VocabularyEntity } from "../../domain/entity/vocabulary.entity";
import { VocabularyFactory } from "../factory/vocabulary.factory";
import { vocabularyTable } from "../table/vocabulary.table";

@Injectable()
export class VocabularyRepository {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ vocabulary: typeof vocabularyTable }>) {}

  async upsert(data: {
    userId: string;
    word: string;
    translation?: string;
    topic?: string;
    lessonId?: string;
  }): Promise<VocabularyEntity> {
    const existing = await this.txHost.tx
      .select()
      .from(vocabularyTable)
      .where(and(eq(vocabularyTable.userId, data.userId), eq(vocabularyTable.word, data.word)))
      .limit(1);

    const existingRow = existing[0];
    if (existingRow) {
      const updates: Partial<typeof vocabularyTable.$inferInsert> = { updatedAt: new Date() };
      if (data.translation && !existingRow.translation) {
        updates.translation = data.translation;
      }
      if (data.topic && !existingRow.topic) {
        updates.topic = data.topic;
      }
      if (data.lessonId && !existingRow.lessonId) {
        updates.lessonId = data.lessonId;
      }

      await this.txHost.tx.update(vocabularyTable).set(updates).where(eq(vocabularyTable.id, existingRow.id));
      return VocabularyFactory.create({ ...existingRow, ...updates } as typeof existingRow);
    }

    const [row] = await this.txHost.tx
      .insert(vocabularyTable)
      .values({
        userId: data.userId,
        word: data.word,
        translation: data.translation,
        topic: data.topic,
        lessonId: data.lessonId,
        status: "new",
        reviewCount: 0,
      })
      .returning();
    if (!row) {
      throw new Error("INSERT into vocabulary did not return a row");
    }
    return VocabularyFactory.create(row);
  }

  async incrementReview(userId: string, words: string[]): Promise<void> {
    if (words.length === 0) {
      return;
    }

    await this.txHost.tx
      .update(vocabularyTable)
      .set({
        reviewCount: sql`${vocabularyTable.reviewCount} + 1`,
        lastReviewedAt: new Date(),
        updatedAt: new Date(),
        status: sql`CASE WHEN ${vocabularyTable.reviewCount} + 1 >= 5 THEN 'learned' ELSE 'learning' END`,
      })
      .where(and(eq(vocabularyTable.userId, userId), inArray(vocabularyTable.word, words)));
  }

  async findByUser(
    userId: string,
    filters?: { status?: string; topic?: string; lessonId?: string },
    offset = 0,
    limit = 50,
  ): Promise<VocabularyEntity[]> {
    const conditions = [eq(vocabularyTable.userId, userId)];
    if (filters?.status) {
      conditions.push(eq(vocabularyTable.status, filters.status));
    }
    if (filters?.topic) {
      conditions.push(eq(vocabularyTable.topic, filters.topic));
    }
    if (filters?.lessonId) {
      conditions.push(eq(vocabularyTable.lessonId, filters.lessonId));
    }

    const rows = await this.txHost.tx
      .select()
      .from(vocabularyTable)
      .where(and(...conditions))
      .orderBy(desc(vocabularyTable.createdAt))
      .offset(offset)
      .limit(limit);
    return VocabularyFactory.createMany(rows);
  }

  async findRecentByUser(userId: string, limit = 20): Promise<VocabularyEntity[]> {
    const rows = await this.txHost.tx
      .select()
      .from(vocabularyTable)
      .where(eq(vocabularyTable.userId, userId))
      .orderBy(desc(vocabularyTable.createdAt))
      .limit(limit);
    return VocabularyFactory.createMany(rows);
  }

  async findNotLearned(userId: string, limit = 30): Promise<VocabularyEntity[]> {
    const rows = await this.txHost.tx
      .select()
      .from(vocabularyTable)
      .where(and(eq(vocabularyTable.userId, userId), sql`${vocabularyTable.status} != 'learned'`))
      .orderBy(desc(vocabularyTable.createdAt))
      .limit(limit);
    return VocabularyFactory.createMany(rows);
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.txHost.tx.delete(vocabularyTable).where(eq(vocabularyTable.userId, userId));
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const result = await this.txHost.tx
      .delete(vocabularyTable)
      .where(and(eq(vocabularyTable.id, id), eq(vocabularyTable.userId, userId)))
      .returning({ id: vocabularyTable.id });
    return result.length > 0;
  }

  async getStats(userId: string): Promise<{ total: number; new: number; learning: number; learned: number }> {
    const rows = await this.txHost.tx
      .select({
        status: vocabularyTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(vocabularyTable)
      .where(eq(vocabularyTable.userId, userId))
      .groupBy(vocabularyTable.status);

    const stats = { total: 0, new: 0, learning: 0, learned: 0 };
    for (const row of rows) {
      const key = row.status as keyof typeof stats;
      if (key in stats && key !== "total") {
        stats[key] = row.count;
      }
      stats.total += row.count;
    }
    return stats;
  }

  async getNewWordsCountForLesson(userId: string, lessonId: string): Promise<number> {
    const [result] = await this.txHost.tx
      .select({ count: sql<number>`count(*)::int` })
      .from(vocabularyTable)
      .where(and(eq(vocabularyTable.userId, userId), eq(vocabularyTable.lessonId, lessonId)));
    return result?.count ?? 0;
  }

  async getTopics(userId: string): Promise<string[]> {
    const rows = await this.txHost.tx
      .select({ topic: vocabularyTable.topic })
      .from(vocabularyTable)
      .where(and(eq(vocabularyTable.userId, userId), sql`${vocabularyTable.topic} IS NOT NULL`))
      .groupBy(vocabularyTable.topic);
    return rows.map((r) => r.topic).filter(Boolean) as string[];
  }
}
