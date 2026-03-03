import { TutorEntity } from "../../domain/entity/tutor.entity";
import { tutorTable } from "../table/tutor.table";

type TutorRow = typeof tutorTable.$inferSelect;

export class TutorFactory {
  static create(row: TutorRow): TutorEntity {
    return row;
  }

  static createMany(rows: TutorRow[]): TutorEntity[] {
    return rows.map(TutorFactory.create);
  }
}
