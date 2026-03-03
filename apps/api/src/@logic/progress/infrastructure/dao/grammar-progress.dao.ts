import { Inject, Injectable } from "@nestjs/common";
import { eq, and, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../../@shared/shared-drizzle-pg/drizzle.provider";
import { grammarProgressTable } from "../table/grammar-progress.table";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class GrammarProgressDao {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

  async findByUser(userId: string) {
    return this.db
      .select()
      .from(grammarProgressTable)
      .where(eq(grammarProgressTable.userId, userId));
  }

  async upsertError(userId: string, topic: string, tx?: PostgresJsDatabase) {
    const db = tx ?? this.db;
    const existing = await db
      .select()
      .from(grammarProgressTable)
      .where(
        and(
          eq(grammarProgressTable.userId, userId),
          eq(grammarProgressTable.topic, topic),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(grammarProgressTable)
        .set({
          errorCount: sql`${grammarProgressTable.errorCount} + 1`,
          level: sql`GREATEST(0, ${grammarProgressTable.level} - 5)`,
          updatedAt: new Date(),
        })
        .where(eq(grammarProgressTable.id, existing[0].id));
    } else {
      await db.insert(grammarProgressTable).values({
        userId,
        topic,
        level: 45,
        errorCount: 1,
      });
    }
  }

  async upsertSuccess(userId: string, topic: string) {
    const existing = await this.db
      .select()
      .from(grammarProgressTable)
      .where(
        and(
          eq(grammarProgressTable.userId, userId),
          eq(grammarProgressTable.topic, topic),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(grammarProgressTable)
        .set({
          successCount: sql`${grammarProgressTable.successCount} + 1`,
          level: sql`LEAST(100, ${grammarProgressTable.level} + 5)`,
          updatedAt: new Date(),
        })
        .where(eq(grammarProgressTable.id, existing[0].id));
    } else {
      await this.db.insert(grammarProgressTable).values({
        userId,
        topic,
        level: 55,
        successCount: 1,
      });
    }
  }
}
