import { type HomeworkEntity } from "../../domain/entity/homework.entity";
import { type homeworkTable } from "../table/homework.table";

type HomeworkRow = typeof homeworkTable.$inferSelect;

export class HomeworkFactory {
  static create(row: HomeworkRow): HomeworkEntity {
    return row;
  }

  static createMany(rows: HomeworkRow[]): HomeworkEntity[] {
    return rows.map((row) => HomeworkFactory.create(row));
  }
}
