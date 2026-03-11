import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { lessonTable } from "./lesson.table";

export const lessonMessageTable = pgTable(
  "lesson_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .references(() => lessonTable.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 10 }).notNull(),
    content: text("content").notNull(),
    audioUrl: text("audio_url"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => ({
    lessonIdx: index("lesson_messages_lesson_idx").on(table.lessonId),
  }),
);
