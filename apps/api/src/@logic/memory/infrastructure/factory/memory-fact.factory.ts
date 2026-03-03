import { MemoryFactEntity } from "../../domain/entity/memory-fact.entity";
import { memoryFactTable } from "../table/memory-fact.table";

type MemoryFactRow = typeof memoryFactTable.$inferSelect;

export class MemoryFactFactory {
  static create(row: MemoryFactRow): MemoryFactEntity {
    return row;
  }

  static createMany(rows: MemoryFactRow[]): MemoryFactEntity[] {
    return rows.map(MemoryFactFactory.create);
  }
}
