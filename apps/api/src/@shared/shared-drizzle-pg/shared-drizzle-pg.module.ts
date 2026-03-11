import { DrizzlePGModule } from "@knaadh/nestjs-drizzle-pg";
import { Module } from "@nestjs/common";
import { ClsPluginTransactional, getTransactionHostToken } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";
import { ClsModule } from "nestjs-cls";

import { SharedConfigModule } from "../shared-config/shared-config.module";
import { DrizzlePgConfig } from "./drizzle-pg.config";

@Module({
  imports: [
    DrizzlePGModule.registerAsync({
      tag: "DB",
      imports: [SharedConfigModule],
      useClass: DrizzlePgConfig,
    }),
    ClsModule.registerPlugins([
      new ClsPluginTransactional({
        imports: [SharedDrizzlePgModule],
        adapter: new TransactionalAdapterDrizzleOrm({
          drizzleInstanceToken: "DB",
        }),
        connectionName: "pg",
      }),
    ]),
  ],
  providers: [
    {
      useExisting: getTransactionHostToken("pg"),
      provide: AppDrizzleTransactionHost,
    },
  ],
  exports: [AppDrizzleTransactionHost],
})
export class SharedDrizzlePgModule {}
