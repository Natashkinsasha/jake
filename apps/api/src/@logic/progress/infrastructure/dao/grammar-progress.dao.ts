import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-cls/app-drizzle-transaction-host";
import { eq, and, sql } from "drizzle-orm";
import { grammarProgressTable } from "../table/grammar-progress.table";

@Injectable()
export class GrammarProgressDao {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ grammarProgress: typeof grammarProgressTable }>) {}

  async findByUser(userId: string) {
    return this.txHost.tx
      .select()
      .from(grammarProgressTable)
      .where(eq(grammarProgressTable.userId, userId));
  }

  async upsertError(userId: string, topic: string) {
    const existing = await this.txHost.tx
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
      await this.txHost.tx
        .update(grammarProgressTable)
        .set({
          errorCount: sql`${grammarProgressTable.errorCount} + 1`,
          level: sql`GREATEST(0, ${grammarProgressTable.level} - 5)`,
          updatedAt: new Date(),
        })
        .where(eq(grammarProgressTable.id, existing[0].id));
    } else {
      await this.txHost.tx.insert(grammarProgressTable).values({
        userId,
        topic,
        level: 45,
        errorCount: 1,
      });
    }
  }

  async upsertSuccess(userId: string, topic: string) {
    const existing = await this.txHost.tx
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
      await this.txHost.tx
        .update(grammarProgressTable)
        .set({
          successCount: sql`${grammarProgressTable.successCount} + 1`,
          level: sql`LEAST(100, ${grammarProgressTable.level} + 5)`,
          updatedAt: new Date(),
        })
        .where(eq(grammarProgressTable.id, existing[0].id));
    } else {
      await this.txHost.tx.insert(grammarProgressTable).values({
        userId,
        topic,
        level: 55,
        successCount: 1,
      });
    }
  }
}
