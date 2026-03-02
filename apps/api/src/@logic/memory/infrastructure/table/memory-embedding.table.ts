import { pgTable, uuid, text, varchar, timestamp, index, customType } from "drizzle-orm/pg-core";
import { userTable } from "../../../auth/infrastructure/table/user.table";
import { lessonTable } from "../../../lesson/infrastructure/table/lesson.table";

const vector = customType<{ data: number[]; driverType: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]) {
    return `[${value.join(",")}]`;
  },
});

export const memoryEmbeddingTable = pgTable(
  "memory_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull(),
    lessonId: uuid("lesson_id").references(() => lessonTable.id),
    content: text("content").notNull(),
    embedding: vector("embedding"),
    emotionalTone: varchar("emotional_tone", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("memory_embeddings_user_idx").on(table.userId),
  }),
);
