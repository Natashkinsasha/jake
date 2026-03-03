import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { RedisService } from "@liaoliaots/nestjs-redis";
import { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";

@Injectable()
export class HealthMaintainer {
  private readonly redis;

  constructor(
    private readonly txHost: AppDrizzleTransactionHost<Record<string, never>>,
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
      await this.txHost.tx.execute(sql`SELECT 1`);
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
