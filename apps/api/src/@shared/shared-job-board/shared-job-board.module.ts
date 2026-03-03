import { Module } from '@nestjs/common';

import { JobBoardModule } from '../../@lib/job-board/src';
import { SharedConfigModule } from '../shared-config/shared-config.module';
import { EnvService } from '../shared-config/env.service';
import { SharedJobModule } from '../shared-job';

@Module({
  imports: [
    JobBoardModule.forRootAsync({
      imports: [SharedJobModule, SharedConfigModule],
      inject: [EnvService],
      useFactory: (envService: EnvService) => {
        return {
          route: envService.get('BULL_BOARD_PATH'),
          username: envService.get('BULL_BOARD_USERNAME'),
          password: envService.get('BULL_BOARD_PASSWORD'),
          enabled: envService.get('BULL_BOARD_ENABLED') === 'true',
        };
      },
    }),
  ],
  exports: [JobBoardModule],
})
export class SharedJobBoardModule {}
