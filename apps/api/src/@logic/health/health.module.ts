import { Module } from "@nestjs/common";
import { SharedRedisModule } from "../../@shared/shared-redis/shared-redis.module";
import { SharedDrizzlePgModule } from "../../@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { HealthController } from "./presentation/health.controller";
import { HealthMaintainer } from "./application/health.maintainer";

@Module({
  imports: [SharedRedisModule, SharedDrizzlePgModule],
  controllers: [HealthController],
  providers: [HealthMaintainer],
})
export class HealthModule {}
