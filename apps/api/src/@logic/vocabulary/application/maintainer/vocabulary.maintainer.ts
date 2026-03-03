import { Injectable } from "@nestjs/common";
import { VocabularyRepository } from "../../infrastructure/repository/vocabulary.repository";

@Injectable()
export class VocabularyMaintainer {
  constructor(private vocabularyRepository: VocabularyRepository) {}

  async listByUser(userId: string) {
    return this.vocabularyRepository.findByUser(userId);
  }

  async getForReview(userId: string) {
    return this.vocabularyRepository.findDueForReview(userId);
  }
}
