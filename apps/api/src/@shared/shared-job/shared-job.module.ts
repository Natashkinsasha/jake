import { RedisService } from "@liaoliaots/nestjs-redis";
import { JobModule } from "@lib/job/src";
import { Module } from "@nestjs/common";
import { SharedRedisModule } from "../shared-redis/shared-redis.module";

@Module({
  imports: [
    JobModule.forRootAsync({
      imports: [SharedRedisModule],
      inject: [RedisService],
      useFactory: (redisService: RedisService) => {
        return {
          connection: redisService.getOrThrow().duplicate({ maxRetriesPerRequest: null }) as any,
          defaultJobOptions: {
            removeOnComplete: {
              count: 100,
              age: 60000,
            },
            removeOnFail: {
              count: 10000,
              age: 60000,
            },
          },
        };
      },
    }),
  ],
  exports: [JobModule],
})
export class SharedJobModule {}
