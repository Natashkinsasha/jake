import { pgTable, uuid, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { userTable } from "../../../auth/infrastructure/table/user.table";
import { tutorTable } from "./tutor.table";

export const userTutorTable = pgTable(
  "user_tutors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull(),
    tutorId: uuid("tutor_id").references(() => tutorTable.id).notNull(),
    isActive: boolean("is_active").default(true),
    selectedAt: timestamp("selected_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("user_tutors_user_idx").on(table.userId),
  }),
);
