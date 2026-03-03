import { type VocabularyEntity } from "../../domain/entity/vocabulary.entity";
import { type vocabularyTable } from "../table/vocabulary.table";

type VocabularyRow = typeof vocabularyTable.$inferSelect;

export class VocabularyFactory {
  static create(row: VocabularyRow): VocabularyEntity {
    return row;
  }

  static createMany(rows: VocabularyRow[]): VocabularyEntity[] {
    return rows.map((row) => VocabularyFactory.create(row));
  }
}
