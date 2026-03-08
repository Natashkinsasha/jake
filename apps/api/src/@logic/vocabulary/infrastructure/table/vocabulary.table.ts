import { pgTable, uuid, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
import { userTable } from "../../../auth/infrastructure/table/user.table";
import { lessonTable } from "../../../lesson/infrastructure/table/lesson.table";

export const vocabularyTable = pgTable(
  "vocabulary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull(),
    word: varchar("word", { length: 255 }).notNull(),
    lessonId: uuid("lesson_id").references(() => lessonTable.id),
    strength: integer("strength").default(0).notNull(),
    nextReview: timestamp("next_review"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("vocabulary_user_idx").on(table.userId),
    reviewIdx: index("vocabulary_review_idx").on(table.userId, table.nextReview),
  }),
);
