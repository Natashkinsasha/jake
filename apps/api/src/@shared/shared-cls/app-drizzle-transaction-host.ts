import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class TransactionHost {
  private readonly als = new AsyncLocalStorage<PostgresJsDatabase>();

  run<T>(tx: PostgresJsDatabase, fn: () => Promise<T>): Promise<T> {
    return this.als.run(tx, fn);
  }

  getTransaction(): PostgresJsDatabase | undefined {
    return this.als.getStore();
  }
}
