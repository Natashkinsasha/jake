import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as schema from '../../@logic/token-ticker/infrastructure/table';

@Injectable()
export class DrizzlePgConfig {
  constructor(private readonly configService: ConfigService) {}

  create() {
    const url = this.configService.get<string>('DATABASE_URL');
    return {
      pg: {
        connection: 'pool' as const,
        config: {
          connectionString: url,
        },
      },
      config: { schema },
    };
  }
}
