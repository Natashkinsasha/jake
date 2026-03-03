import { RedisService } from '@liaoliaots/nestjs-redis';
import { Module } from '@nestjs/common';
import { SharedRedisModule } from "../shared-redis/shared-redis.module";
import { JobModule } from '../../@lib/job/src';

@Module({
  imports: [
    JobModule.forRootAsync({
      imports: [SharedRedisModule],
      inject: [RedisService],
      useFactory: (redisService: RedisService) => {
        return {
          connection: redisService
            .getOrThrow()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ioredis version mismatch between packages
            .duplicate({ maxRetriesPerRequest: null }) as any,
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
