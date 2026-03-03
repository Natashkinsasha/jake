import { type homeworkTable } from "../../infrastructure/table/homework.table";

export type HomeworkEntity = typeof homeworkTable.$inferSelect;
