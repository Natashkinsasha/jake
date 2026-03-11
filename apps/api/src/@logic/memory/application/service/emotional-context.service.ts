import { Injectable } from "@nestjs/common";
import type { MemoryEmbeddingRepository } from "../../infrastructure/repository/memory-embedding.repository";

@Injectable()
export class EmotionalContextService {
  constructor(private embeddingRepository: MemoryEmbeddingRepository) {}

  async getRecentEmotions(userId: string, limit = 5) {
    return this.embeddingRepository.findRecentByUser(userId, limit);
  }
}
