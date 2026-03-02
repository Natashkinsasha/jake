import { pgTable, uuid, varchar, text, jsonb, boolean } from "drizzle-orm/pg-core";

export const tutorTable = pgTable("tutors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  personality: text("personality").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  voiceId: varchar("voice_id", { length: 255 }).notNull(),
  accent: varchar("accent", { length: 50 }).notNull(),
  avatarUrl: text("avatar_url"),
  traits: jsonb("traits").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
});
