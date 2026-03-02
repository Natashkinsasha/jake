import { Module } from "@nestjs/common";
import { HealthController } from "./presentation/health.controller";
import { HealthMaintainer } from "./application/health.maintainer";

@Module({
  controllers: [HealthController],
  providers: [HealthMaintainer],
})
export class HealthModule {}
