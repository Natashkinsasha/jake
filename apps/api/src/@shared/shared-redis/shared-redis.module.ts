import { RedisModule, RedisModuleOptions } from '@liaoliaots/nestjs-redis';
import type { Redis } from 'ioredis';
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SharedConfigModule } from '../shared-config/shared-config.module';

@Module({
  imports: [
    RedisModule.forRootAsync(
      {
        imports: [SharedConfigModule],
        useFactory: (configService: unknown): RedisModuleOptions => {
          const cfg = configService as ConfigService;
          const redisUrl: string = cfg.getOrThrow('REDIS_URL');
          const redisDbNumber = Number(cfg.getOrThrow('REDIS_DB_NUMBER'));
          Logger.debug(
            `Redis uri: ${redisUrl}. Db number: ${redisDbNumber}`,
            'RedisModule',
          );
          return {
            readyLog: true,
            errorLog: true,
            closeClient: true,
            config: [
              {
                url: redisUrl,
                db: redisDbNumber,
                connectTimeout: 10000,
                onClientCreated: (client: Redis) => {
                  Logger.debug(
                    `Connected to redis: ${redisUrl}/${redisDbNumber}`,
                    'RedisModule',
                  );
                  client.on('error', (error: Error) => {
                    Logger.error(`Redis error: ${error}`, 'RedisModule');
                  });
                },
              },
            ],
          };
        },
        inject: [ConfigService],
      },
      false,
    ),
  ],
  exports: [RedisModule],
})
export class SharedRedisModule {}
