import { DrizzlePGModule } from '@knaadh/nestjs-drizzle-pg';
import { Module } from '@nestjs/common';

import { SharedConfigModule } from '../shared-config/shared-config.module';
import { DrizzlePgConfig } from './drizzle-pg.config';

@Module({
  imports: [
    DrizzlePGModule.registerAsync({
      tag: 'DB',
      imports: [SharedConfigModule],
      useClass: DrizzlePgConfig,
    }),
  ],
  exports: [DrizzlePGModule],
})
export class SharedDrizzlePgModule {}
