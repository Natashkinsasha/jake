import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JobBoardModule } from '../../@lib/job-board/src';
import { SharedConfigModule } from '../shared-config/shared-config.module';
import { SharedJobModule } from '../shared-job';

@Module({
  imports: [
    JobBoardModule.forRootAsync({
      imports: [SharedJobModule, SharedConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          route: configService.getOrThrow('BULL_BOARD_PATH'),
          username: configService.getOrThrow('BULL_BOARD_USERNAME'),
          password: configService.getOrThrow('BULL_BOARD_PASSWORD'),
          enabled: configService.getOrThrow('BULL_BOARD_ENABLED') === 'true',
        };
      },
    }),
  ],
  exports: [JobBoardModule],
})
export class SharedJobBoardModule {}
