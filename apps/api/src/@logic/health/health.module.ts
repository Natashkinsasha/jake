import { Module } from "@nestjs/common";
import { HealthController } from "./presentation/health.controller";
import { HealthMaintainer } from "./application/health.maintainer";
import { PgHealthIndicatorService } from "./health-indicator/pg-health-indicator.service";

@Module({
  controllers: [HealthController],
  providers: [HealthMaintainer, PgHealthIndicatorService],
})
export class HealthModule {}
