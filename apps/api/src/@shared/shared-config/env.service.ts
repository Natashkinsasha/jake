import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Env } from "./env.schema";

@Injectable()
export class EnvService {
  constructor(private configService: ConfigService) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.configService.get(key) as Env[K];
  }
}
