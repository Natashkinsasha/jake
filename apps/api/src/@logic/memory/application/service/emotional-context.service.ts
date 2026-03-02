import { Injectable } from "@nestjs/common";
import { MemoryEmbeddingDao } from "../../infrastructure/dao/memory-embedding.dao";

@Injectable()
export class EmotionalContextService {
  constructor(private embeddingDao: MemoryEmbeddingDao) {}

  async getRecentEmotions(userId: string, limit = 5) {
    return this.embeddingDao.findRecentByUser(userId, limit);
  }
}
