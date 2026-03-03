import { GrammarProgressEntity } from "../../domain/entity/grammar-progress.entity";
import { grammarProgressTable } from "../table/grammar-progress.table";

type GrammarProgressRow = typeof grammarProgressTable.$inferSelect;

export class GrammarProgressFactory {
  static create(row: GrammarProgressRow): GrammarProgressEntity {
    return row;
  }

  static createMany(rows: GrammarProgressRow[]): GrammarProgressEntity[] {
    return rows.map(GrammarProgressFactory.create);
  }
}
