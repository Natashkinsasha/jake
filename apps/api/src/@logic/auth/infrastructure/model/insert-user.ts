import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod";
import { userTable } from "../table/user.table";

export const insertUserSchema = createInsertSchema(userTable);
export type InsertUser = z.infer<typeof insertUserSchema>;
