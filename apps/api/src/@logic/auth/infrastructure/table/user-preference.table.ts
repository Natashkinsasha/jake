import {
  pgTable, uuid, varchar, boolean, jsonb, timestamp,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.table";

export const userPreferenceTable = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull().unique(),
  correctionStyle: varchar("correction_style", { length: 50 }).default("immediate"),
  explainGrammar: boolean("explain_grammar").default(true),
  speakingSpeed: varchar("speaking_speed", { length: 20 }).default("natural"),
  useNativeLanguage: boolean("use_native_language").default(false),
  preferredExerciseTypes: jsonb("preferred_exercise_types").$type<string[]>().default([]),
  interests: jsonb("interests").$type<string[]>().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
