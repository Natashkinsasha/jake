import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { userTable } from "../../../auth/infrastructure/table/user.table";

export const lessonTable = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    durationMinutes: integer("duration_minutes"),
    summary: text("summary"),
    topics: jsonb("topics").$type<string[]>().default([]),
    newWords: jsonb("new_words").$type<string[]>().default([]),
    errorsFound: jsonb("errors_found")
      .$type<Array<{ text: string; correction: string; topic: string }>>()
      .default([]),
    levelAssessment: varchar("level_assessment", { length: 5 }),
    lessonNumber: integer("lesson_number").notNull(),
  },
  (table) => ({
    userIdx: index("lessons_user_idx").on(table.userId),
    statusIdx: index("lessons_status_idx").on(table.userId, table.status),
  }),
);
