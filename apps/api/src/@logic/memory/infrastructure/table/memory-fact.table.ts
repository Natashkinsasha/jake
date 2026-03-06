import { pgTable, uuid, varchar, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { userTable } from "../../../auth/infrastructure/table/user.table";

export const memoryFactTable = pgTable(
  "memory_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull(),
    category: varchar("category", { length: 50 }).notNull(),
    fact: text("fact").notNull(),
    source: varchar("source", { length: 255 }).notNull(),
    isActive: boolean("is_active").default(true),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("memory_facts_user_idx").on(table.userId),
    categoryIdx: index("memory_facts_category_idx").on(table.userId, table.category),
  }),
);
