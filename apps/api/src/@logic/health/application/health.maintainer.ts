import { Injectable } from "@nestjs/common";
import { PgHealthIndicatorService } from "../health-indicator/pg-health-indicator.service";

@Injectable()
export class HealthMaintainer {
  constructor(private pgHealth: PgHealthIndicatorService) {}

  async check() {
    const db = await this.pgHealth.isHealthy();
    return {
      status: db ? "ok" : "error",
      checks: { database: db ? "up" : "down" },
      timestamp: new Date().toISOString(),
    };
  }
}
