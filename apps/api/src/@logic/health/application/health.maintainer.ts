import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { RedisService } from "@liaoliaots/nestjs-redis";
import { DRIZZLE } from "../../../@shared/shared-drizzle-pg/drizzle.provider";

@Injectable()
export class HealthMaintainer {
  private readonly redis;

  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase,
    redisService: RedisService,
  ) {
    this.redis = redisService.getOrThrow();
  }

  async check() {
    const [dbOk, redisOk] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
    ]);

    const allUp = dbOk && redisOk;

    return {
      status: allUp ? ("ok" as const) : ("degraded" as const),
      db: dbOk ? ("up" as const) : ("down" as const),
      redis: redisOk ? ("up" as const) : ("down" as const),
      uptime: process.uptime(),
    };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === "PONG";
    } catch {
      return false;
    }
  }
}
