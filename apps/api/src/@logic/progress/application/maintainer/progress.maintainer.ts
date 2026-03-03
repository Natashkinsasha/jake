import { Injectable } from "@nestjs/common";
import { GrammarProgressRepository } from "../../infrastructure/repository/grammar-progress.repository";

@Injectable()
export class ProgressMaintainer {
  constructor(private grammarProgressRepository: GrammarProgressRepository) {}

  async getOverview(userId: string) {
    const progress = await this.grammarProgressRepository.findByUser(userId);
    return {
      grammarTopics: progress,
    };
  }
}
