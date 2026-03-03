import { type userTutorTable } from "../../infrastructure/table/user-tutor.table";
import { type TutorEntity } from "./tutor.entity";

export type UserTutorEntity = typeof userTutorTable.$inferSelect;

export type UserTutorWithTutor = {
  userTutor: UserTutorEntity;
  tutor: TutorEntity;
};
