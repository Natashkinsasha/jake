import { TransactionHost } from '@nestjs-cls/transactional';
import { type TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';

export class AppDrizzleTransactionHost<T extends Record<string, unknown>> extends TransactionHost<
  TransactionalAdapterDrizzleOrm<NodePgDatabase<T>>
> {}
