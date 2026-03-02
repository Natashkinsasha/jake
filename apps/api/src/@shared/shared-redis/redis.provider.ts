import { Provider } from "@nestjs/common";
import Redis from "ioredis";
import { EnvService } from "../shared-config/env.service";

export const REDIS = Symbol("REDIS");

export const redisProvider: Provider = {
  provide: REDIS,
  inject: [EnvService],
  useFactory: (envService: EnvService) => {
    return new Redis(envService.get("REDIS_URL"));
  },
};
