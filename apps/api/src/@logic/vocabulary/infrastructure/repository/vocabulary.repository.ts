import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";
import { eq, desc, and } from "drizzle-orm";
import { vocabularyTable } from "../table/vocabulary.table";
import { VocabularyEntity } from "../../domain/entity/vocabulary.entity";
import { VocabularyFactory } from "../factory/vocabulary.factory";

@Injectable()
export class VocabularyRepository {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ vocabulary: typeof vocabularyTable }>) {}

  async upsert(data: { userId: string; word: string; translation?: string; topic?: string; lessonId: string }): Promise<VocabularyEntity> {
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

    const existingRow = existing[0];
    if (existingRow) {
      const updates: Partial<typeof vocabularyTable.$inferInsert> = { updatedAt: new Date() };
      if (data.translation) updates.translation = data.translation;
      if (data.topic) updates.topic = data.topic;
      await this.txHost.tx
        .update(vocabularyTable)
        .set(updates)
        .where(eq(vocabularyTable.id, existingRow.id));
      return VocabularyFactory.create({ ...existingRow, ...updates } as typeof existingRow);
    }

    const [row] = await this.txHost.tx.insert(vocabularyTable).values(data).returning();
    if (!row) throw new Error("INSERT into vocabulary did not return a row");
    return VocabularyFactory.create(row);
  }

  async findByUser(userId: string): Promise<VocabularyEntity[]> {
    const rows = await this.txHost.tx
      .select()
      .from(vocabularyTable)
      .where(eq(vocabularyTable.userId, userId))
      .orderBy(desc(vocabularyTable.createdAt));
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

  async deleteByUser(userId: string): Promise<void> {
    await this.txHost.tx.delete(vocabularyTable).where(eq(vocabularyTable.userId, userId));
  }

  async deleteById(id: string, userId: string): Promise<void> {
    await this.txHost.tx
      .delete(vocabularyTable)
      .where(and(eq(vocabularyTable.id, id), eq(vocabularyTable.userId, userId)));
  }
}
