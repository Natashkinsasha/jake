import { index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { userTable } from "../../../auth/infrastructure/table/user.table";
import { lessonTable } from "../../../lesson/infrastructure/table/lesson.table";

export const vocabularyTable = pgTable(
  "vocabulary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    word: varchar("word", { length: 255 }).notNull(),
    translation: varchar("translation", { length: 255 }),
    topic: varchar("topic", { length: 100 }),
    lessonId: uuid("lesson_id").references(() => lessonTable.id),
    status: varchar("status", { length: 20 }).default("new").notNull(),
    reviewCount: integer("review_count").default(0).notNull(),
    lastReviewedAt: timestamp("last_reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("vocabulary_user_idx").on(table.userId),
    statusIdx: index("vocabulary_status_idx").on(table.userId, table.status),
  }),
);
