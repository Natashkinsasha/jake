import { Module } from "@nestjs/common";
import { SharedRedisModule } from "../../@shared/shared-redis/shared-redis.module";
import { HealthController } from "./presentation/health.controller";
import { HealthMaintainer } from "./application/health.maintainer";

@Module({
  imports: [SharedRedisModule],
  controllers: [HealthController],
  providers: [HealthMaintainer],
})
export class HealthModule {}
