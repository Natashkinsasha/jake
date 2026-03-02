import { Module } from "@nestjs/common";
import { SharedConfigModule } from "../shared-config/shared-config.module";
import { redisProvider, REDIS } from "./redis.provider";

@Module({
  imports: [SharedConfigModule],
  providers: [redisProvider],
  exports: [REDIS],
})
export class SharedRedisModule {}
