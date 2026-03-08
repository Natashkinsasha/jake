import { Injectable } from "@nestjs/common";
import { GrammarProgressRepository } from "../infrastructure/repository/grammar-progress.repository";
import { GrammarProgressEntity } from "../domain/entity/grammar-progress.entity";

@Injectable()
export class ProgressContract {
  constructor(private grammarProgressRepository: GrammarProgressRepository) {}

  async findByUser(userId: string): Promise<GrammarProgressEntity[]> {
    return this.grammarProgressRepository.findByUser(userId);
  }

  async upsertError(userId: string, topic: string): Promise<void> {
    return this.grammarProgressRepository.upsertError(userId, topic);
  }

  async deleteByUser(userId: string): Promise<void> {
    return this.grammarProgressRepository.deleteByUser(userId);
  }
}
