import {
  pgTable, uuid, varchar, boolean, jsonb, timestamp,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.table";

export const userPreferenceTable = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull().unique(),
  correctionStyle: varchar("correction_style", { length: 50 }).default("immediate"),
  explainGrammar: boolean("explain_grammar").default(true),
  speakingSpeed: varchar("speaking_speed", { length: 20 }).default("very_slow"),
  useNativeLanguage: boolean("use_native_language").default(false),
  ttsModel: varchar("tts_model", { length: 50 }).default("eleven_turbo_v2_5"),
  preferredExerciseTypes: jsonb("preferred_exercise_types").$type<string[]>().default([]),
  interests: jsonb("interests").$type<string[]>().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
