import { type z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { userTable } from "../table/user.table";

export const selectUserSchema = createSelectSchema(userTable);
export type SelectUser = z.infer<typeof selectUserSchema>;
