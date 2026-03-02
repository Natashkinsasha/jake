import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, from, switchMap } from "rxjs";
import { TRANSACTION_KEY } from "./transaction";
import { TransactionHost } from "./app-drizzle-transaction-host";
import { DRIZZLE } from "../shared-drizzle-pg/drizzle.provider";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private txHost: TransactionHost,
    @Inject(DRIZZLE) private db: PostgresJsDatabase,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isTransaction = this.reflector.get<boolean>(
      TRANSACTION_KEY,
      context.getHandler(),
    );

    if (!isTransaction) {
      return next.handle();
    }

    return from(
      this.db.transaction(async (tx) => {
        return this.txHost.run(tx as any, () => {
          return new Promise((resolve, reject) => {
            next.handle().subscribe({
              next: resolve,
              error: reject,
            });
          });
        });
      }),
    );
  }
}
