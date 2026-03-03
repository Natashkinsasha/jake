import { HomeworkEntity } from "../../domain/entity/homework.entity";
import { homeworkTable } from "../table/homework.table";

type HomeworkRow = typeof homeworkTable.$inferSelect;

export class HomeworkFactory {
  static create(row: HomeworkRow): HomeworkEntity {
    return row;
  }

  static createMany(rows: HomeworkRow[]): HomeworkEntity[] {
    return rows.map(HomeworkFactory.create);
  }
}
