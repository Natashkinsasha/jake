import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DRIZZLE } from "../../../@shared/shared-drizzle-pg/drizzle.provider";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class PgHealthIndicatorService {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

  async isHealthy(): Promise<boolean> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }
}
