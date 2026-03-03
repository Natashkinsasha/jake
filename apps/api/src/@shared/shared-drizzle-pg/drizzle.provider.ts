import { Provider } from "@nestjs/common";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { EnvService } from "../shared-config/env.service";

export const DRIZZLE = Symbol("DRIZZLE");

export const drizzleProvider: Provider = {
  provide: DRIZZLE,
  inject: [EnvService],
  useFactory: (envService: EnvService) => {
    const client = postgres(envService.get("DATABASE_URL"), { max: 10 });
    return drizzle(client);
  },
};
