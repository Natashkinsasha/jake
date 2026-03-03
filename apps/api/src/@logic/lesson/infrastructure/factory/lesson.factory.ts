import { LessonEntity } from "../../domain/entity/lesson.entity";
import { lessonTable } from "../table/lesson.table";

type LessonRow = typeof lessonTable.$inferSelect;

export class LessonFactory {
  static create(row: LessonRow): LessonEntity {
    return row;
  }

  static createMany(rows: LessonRow[]): LessonEntity[] {
    return rows.map(LessonFactory.create);
  }
}
