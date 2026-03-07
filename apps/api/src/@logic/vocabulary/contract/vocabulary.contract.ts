import { Injectable } from "@nestjs/common";
import { VocabularyRepository } from "../infrastructure/repository/vocabulary.repository";
import { VocabularyEntity } from "../domain/entity/vocabulary.entity";

@Injectable()
export class VocabularyContract {
  constructor(private vocabularyRepository: VocabularyRepository) {}

  async findRecentByUser(userId: string, limit = 20): Promise<VocabularyEntity[]> {
    return this.vocabularyRepository.findRecentByUser(userId, limit);
  }

  async findNotLearned(userId: string, limit = 30): Promise<VocabularyEntity[]> {
    return this.vocabularyRepository.findNotLearned(userId, limit);
  }

  async findByUser(
    userId: string,
    filters?: { status?: string; topic?: string; lessonId?: string },
    offset?: number,
    limit?: number,
  ): Promise<VocabularyEntity[]> {
    return this.vocabularyRepository.findByUser(userId, filters, offset, limit);
  }

  async upsert(data: {
    userId: string;
    word: string;
    translation?: string;
    topic?: string;
    lessonId?: string;
  }): Promise<VocabularyEntity> {
    return this.vocabularyRepository.upsert(data);
  }

  async deleteByUser(userId: string): Promise<void> {
    return this.vocabularyRepository.deleteByUser(userId);
  }

  async incrementReview(userId: string, words: string[]): Promise<void> {
    return this.vocabularyRepository.incrementReview(userId, words);
  }

  async getStats(userId: string): Promise<{ total: number; new: number; learning: number; learned: number }> {
    return this.vocabularyRepository.getStats(userId);
  }

  async getNewWordsCountForLesson(userId: string, lessonId: string): Promise<number> {
    return this.vocabularyRepository.getNewWordsCountForLesson(userId, lessonId);
  }

  async getTopics(userId: string): Promise<string[]> {
    return this.vocabularyRepository.getTopics(userId);
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    return this.vocabularyRepository.deleteById(id, userId);
  }
}
