import { UserTutorEntity, UserTutorWithTutor } from "../../domain/entity/user-tutor.entity";
import { userTutorTable } from "../table/user-tutor.table";
import { tutorTable } from "../table/tutor.table";

type UserTutorRow = typeof userTutorTable.$inferSelect;
type UserTutorJoinRow = {
  user_tutors: typeof userTutorTable.$inferSelect;
  tutors: typeof tutorTable.$inferSelect;
};

export class UserTutorFactory {
  static create(row: UserTutorRow): UserTutorEntity {
    return row;
  }

  static createWithTutor(row: UserTutorJoinRow): UserTutorWithTutor {
    return {
      userTutor: row.user_tutors,
      tutor: row.tutors,
    };
  }
}
