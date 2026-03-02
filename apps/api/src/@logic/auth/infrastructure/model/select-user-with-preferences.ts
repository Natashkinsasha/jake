import { SelectUser } from "./select-user";
import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { userPreferenceTable } from "../table/user-preference.table";

const selectUserPreferenceSchema = createSelectSchema(userPreferenceTable);
type SelectUserPreference = z.infer<typeof selectUserPreferenceSchema>;

export type SelectUserWithPreferences = {
  users: SelectUser;
  user_preferences: SelectUserPreference | null;
};
