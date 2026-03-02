import { Module } from "@nestjs/common";
import { SharedDrizzlePgModule } from "../../@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedRedisModule } from "../../@shared/shared-redis/shared-redis.module";
import { HealthController } from "./presentation/health.controller";
import { HealthMaintainer } from "./application/health.maintainer";

@Module({
  imports: [SharedDrizzlePgModule, SharedRedisModule],
  controllers: [HealthController],
  providers: [HealthMaintainer],
})
export class HealthModule {}
