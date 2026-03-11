import type { userTable } from "../../infrastructure/table/user.table";
import type { userPreferenceTable } from "../../infrastructure/table/user-preference.table";

export type UserEntity = typeof userTable.$inferSelect;

export type UserPreferenceEntity = typeof userPreferenceTable.$inferSelect;

export type UserWithPreferences = {
  users: UserEntity;
  user_preferences: UserPreferenceEntity | null;
};
