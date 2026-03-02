import { pgTable, uuid, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { userTable } from "../../../auth/infrastructure/table/user.table";
import { lessonTable } from "../../../lesson/infrastructure/table/lesson.table";

export const homeworkTable = pgTable("homework", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull(),
  lessonId: uuid("lesson_id").references(() => lessonTable.id).notNull(),
  exercises: jsonb("exercises").$type<any[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  score: integer("score"),
});
