import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

export class AppDrizzleTransactionHost<T extends Record<string, unknown>> extends TransactionHost<
  TransactionalAdapterDrizzleOrm<NodePgDatabase<T>>
> {}
