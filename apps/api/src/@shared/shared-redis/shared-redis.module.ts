import { RedisModule, type RedisModuleOptions } from "@liaoliaots/nestjs-redis";
import { Logger, Module } from "@nestjs/common";
import type { Redis } from "ioredis";
import { EnvService } from "../shared-config/env.service";
import { SharedConfigModule } from "../shared-config/shared-config.module";

@Module({
  imports: [
    RedisModule.forRootAsync(
      {
        imports: [SharedConfigModule],
        useFactory: (...args: unknown[]): RedisModuleOptions => {
          const envService = args[0] as EnvService;
          const redisUrl = envService.get("REDIS_URL");
          const redisDbNumber = envService.get("REDIS_DB_NUMBER");
          Logger.debug(`Redis uri: ${redisUrl}. Db number: ${redisDbNumber}`, "RedisModule");
          return {
            readyLog: true,
            errorLog: true,
            closeClient: true,
            config: [
              {
                url: redisUrl,
                db: redisDbNumber,
                connectTimeout: 10_000,
                onClientCreated: (client: Redis) => {
                  Logger.debug(`Connected to redis: ${redisUrl}/${redisDbNumber}`, "RedisModule");
                  client.on("error", (error: Error) => {
                    Logger.error(`Redis error: ${error.message}`, "RedisModule");
                  });
                },
              },
            ],
          };
        },
        inject: [EnvService],
      },
      false,
    ),
  ],
  exports: [RedisModule],
})
export class SharedRedisModule {}
