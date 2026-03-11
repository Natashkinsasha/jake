import { customType, integer, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { userTable } from "../../../auth/infrastructure/table/user.table";

const vector = customType<{ data: number[]; driverType: string }>({
  dataType() {
    return "vector(256)";
  },
  toDriver(value: number[]) {
    return `[${value.join(",")}]`;
  },
});

export const voicePrintTable = pgTable(
  "voice_prints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    embedding: vector("embedding"),
    sampleCount: integer("sample_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: uniqueIndex("voice_prints_user_idx").on(table.userId),
  }),
);
