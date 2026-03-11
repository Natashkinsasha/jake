import { Module } from "@nestjs/common";
import { SharedDrizzlePgModule } from "@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedRedisModule } from "@shared/shared-redis/shared-redis.module";
import { HealthMaintainer } from "./application/health.maintainer";
import { HealthController } from "./presentation/health.controller";

@Module({
  imports: [SharedRedisModule, SharedDrizzlePgModule],
  controllers: [HealthController],
  providers: [HealthMaintainer],
})
export class HealthModule {}
