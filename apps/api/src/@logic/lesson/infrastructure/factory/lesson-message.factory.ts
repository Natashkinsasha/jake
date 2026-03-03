import { LessonMessageEntity } from "../../domain/entity/lesson-message.entity";
import { lessonMessageTable } from "../table/lesson-message.table";

type LessonMessageRow = typeof lessonMessageTable.$inferSelect;

export class LessonMessageFactory {
  static create(row: LessonMessageRow): LessonMessageEntity {
    return row;
  }

  static createMany(rows: LessonMessageRow[]): LessonMessageEntity[] {
    return rows.map(LessonMessageFactory.create);
  }
}
