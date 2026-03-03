import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { RedisService } from "@liaoliaots/nestjs-redis";
import { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";
import type Redis from "ioredis";

@Injectable()
export class HealthMaintainer {
  private readonly redis: Redis;

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
      status: allUp ? "ok" : "degraded",
      db: dbOk ? "up" : "down",
      redis: redisOk ? "up" : "down",
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
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}
