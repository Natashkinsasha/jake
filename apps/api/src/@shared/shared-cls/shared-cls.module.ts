import { Module } from '@nestjs/common';
import {
  ClsPluginTransactional,
  getTransactionHostToken,
} from '@nestjs-cls/transactional';
import { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { ClsModule } from 'nestjs-cls';

import { SharedDrizzlePgModule } from '../shared-drizzle-pg/shared-drizzle-pg.module';
import { AppDrizzleTransactionHost } from './app-drizzle-transaction-host';

@Module({
  imports: [
    ClsModule.forRoot({
      plugins: [
        new ClsPluginTransactional({
          imports: [SharedDrizzlePgModule],
          adapter: new TransactionalAdapterDrizzleOrm({
            drizzleInstanceToken: 'DB',
          }),
          connectionName: 'pg',
        }),
      ],
    }),
  ],
  providers: [
    {
      useExisting: getTransactionHostToken('pg'),
      provide: AppDrizzleTransactionHost,
    },
  ],
  exports: [AppDrizzleTransactionHost, ClsModule],
})
export class SharedClsModule {}
