import { index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { userTable } from "../../../auth/infrastructure/table/user.table";

export const grammarProgressTable = pgTable(
  "grammar_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    topic: varchar("topic", { length: 255 }).notNull(),
    level: integer("level").default(50).notNull(),
    errorCount: integer("error_count").default(0).notNull(),
    successCount: integer("success_count").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("grammar_progress_user_idx").on(table.userId),
    topicIdx: index("grammar_progress_topic_idx").on(table.userId, table.topic),
  }),
);
