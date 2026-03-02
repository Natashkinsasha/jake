import { createSelectSchema } from "drizzle-zod";
import { userTable } from "../table/user.table";

export const selectUserSchema = createSelectSchema(userTable);
export type SelectUser = typeof userTable.$inferSelect;
