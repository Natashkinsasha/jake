import { Global, Module } from "@nestjs/common";
import { redisProvider, REDIS } from "./redis.provider";

@Global()
@Module({
  providers: [redisProvider],
  exports: [REDIS],
})
export class SharedRedisModule {}
