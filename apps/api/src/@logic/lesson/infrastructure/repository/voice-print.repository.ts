import { Injectable } from "@nestjs/common";
import type { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";
import { eq } from "drizzle-orm";
import { voicePrintTable } from "../table/voice-print.table";

@Injectable()
export class VoicePrintRepository {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ voicePrint: typeof voicePrintTable }>) {}

  async findByUser(userId: string) {
    const rows = await this.txHost.tx.select().from(voicePrintTable).where(eq(voicePrintTable.userId, userId)).limit(1);
    return rows[0] ?? null;
  }

  async upsert(userId: string, embedding: number[], sampleCount: number) {
    const existing = await this.findByUser(userId);
    if (existing) {
      await this.txHost.tx
        .update(voicePrintTable)
        .set({ embedding, sampleCount, updatedAt: new Date() })
        .where(eq(voicePrintTable.userId, userId));
    } else {
      await this.txHost.tx.insert(voicePrintTable).values({
        userId,
        embedding,
        sampleCount,
      });
    }
  }
}
