import { Injectable } from "@nestjs/common";
import type { EnvService } from "@shared/shared-config/env.service";

@Injectable()
export class DrizzlePgConfig {
  constructor(private readonly envService: EnvService) {}

  create() {
    const url = this.envService.get("DATABASE_URL");
    return {
      pg: {
        connection: "pool" as const,
        config: {
          connectionString: url,
        },
      },
    };
  }
}
