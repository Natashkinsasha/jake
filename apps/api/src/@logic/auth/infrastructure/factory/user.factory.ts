import { type UserEntity, type UserWithPreferences } from "../../domain/entity/user.entity";
import { type userTable } from "../table/user.table";
import { type userPreferenceTable } from "../table/user-preference.table";

type UserRow = typeof userTable.$inferSelect;
type UserJoinRow = {
  users: typeof userTable.$inferSelect;
  user_preferences: typeof userPreferenceTable.$inferSelect | null;
};

export class UserFactory {
  static create(row: UserRow): UserEntity {
    return row;
  }

  static createWithPreferences(row: UserJoinRow): UserWithPreferences {
    return row;
  }
}
