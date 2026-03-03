import { tutorTable } from "../../infrastructure/table/tutor.table";

export type TutorEntity = typeof tutorTable.$inferSelect;
