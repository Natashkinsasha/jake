import { Injectable } from "@nestjs/common";
import { GrammarProgressDao } from "../../infrastructure/dao/grammar-progress.dao";

@Injectable()
export class ProgressMaintainer {
  constructor(private grammarProgressDao: GrammarProgressDao) {}

  async getOverview(userId: string) {
    const progress = await this.grammarProgressDao.findByUser(userId);
    return {
      grammarTopics: progress,
    };
  }
}
