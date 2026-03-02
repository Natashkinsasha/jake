import { createInsertSchema } from "drizzle-zod";
import { userTable } from "../table/user.table";

export const insertUserSchema = createInsertSchema(userTable);
export type InsertUser = typeof userTable.$inferInsert;
