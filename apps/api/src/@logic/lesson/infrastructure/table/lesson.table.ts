import { pgTable, uuid, varchar, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { userTable } from "../../../auth/infrastructure/table/user.table";
import { tutorTable } from "../../../tutor/infrastructure/table/tutor.table";

export const lessonTable = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull(),
  tutorId: uuid("tutor_id").references(() => tutorTable.id).notNull(),
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
});
