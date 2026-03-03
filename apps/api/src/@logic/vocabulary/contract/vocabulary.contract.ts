import { Injectable } from "@nestjs/common";
import { VocabularyRepository } from "../infrastructure/repository/vocabulary.repository";
import { VocabularyEntity } from "../domain/entity/vocabulary.entity";

@Injectable()
export class VocabularyContract {
  constructor(private vocabularyRepository: VocabularyRepository) {}

  async findRecentByUser(userId: string, limit = 20): Promise<VocabularyEntity[]> {
    return this.vocabularyRepository.findRecentByUser(userId, limit);
  }

  async upsert(data: { userId: string; word: string; lessonId: string; strength: number; nextReview: Date }): Promise<VocabularyEntity> {
    return this.vocabularyRepository.upsert(data);
  }
}
