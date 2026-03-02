import { userTable } from "../table/user.table";
import { userPreferenceTable } from "../table/user-preference.table";

export type SelectUserWithPreferences = {
  users: typeof userTable.$inferSelect;
  user_preferences: typeof userPreferenceTable.$inferSelect | null;
};
