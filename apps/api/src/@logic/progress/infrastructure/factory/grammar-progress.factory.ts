import type { GrammarProgressEntity } from "../../domain/entity/grammar-progress.entity";
import type { grammarProgressTable } from "../table/grammar-progress.table";

type GrammarProgressRow = typeof grammarProgressTable.$inferSelect;

export class GrammarProgressFactory {
  static create(row: GrammarProgressRow): GrammarProgressEntity {
    return row;
  }

  static createMany(rows: GrammarProgressRow[]): GrammarProgressEntity[] {
    return rows.map((row) => GrammarProgressFactory.create(row));
  }
}
