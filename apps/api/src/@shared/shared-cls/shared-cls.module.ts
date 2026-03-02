import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { TransactionInterceptor } from "./transaction.interceptor";
import { TransactionHost } from "./app-drizzle-transaction-host";

@Global()
@Module({
  providers: [
    TransactionHost,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransactionInterceptor,
    },
  ],
  exports: [TransactionHost],
})
export class SharedClsModule {}
