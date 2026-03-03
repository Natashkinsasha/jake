import { VocabularyEntity } from "../../domain/entity/vocabulary.entity";
import { vocabularyTable } from "../table/vocabulary.table";

type VocabularyRow = typeof vocabularyTable.$inferSelect;

export class VocabularyFactory {
  static create(row: VocabularyRow): VocabularyEntity {
    return row;
  }

  static createMany(rows: VocabularyRow[]): VocabularyEntity[] {
    return rows.map(VocabularyFactory.create);
  }
}
