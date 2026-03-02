import { Injectable } from "@nestjs/common";
import { VocabularyDao } from "../../infrastructure/dao/vocabulary.dao";

@Injectable()
export class VocabularyMaintainer {
  constructor(private vocabularyDao: VocabularyDao) {}

  async listByUser(userId: string) {
    return this.vocabularyDao.findByUser(userId);
  }

  async getForReview(userId: string) {
    return this.vocabularyDao.findDueForReview(userId);
  }
}
