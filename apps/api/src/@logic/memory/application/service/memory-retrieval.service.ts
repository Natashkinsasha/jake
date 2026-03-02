import { Injectable } from "@nestjs/common";
import { MemoryFactDao } from "../../infrastructure/dao/memory-fact.dao";
import { MemoryEmbeddingDao } from "../../infrastructure/dao/memory-embedding.dao";
import { EmbeddingService } from "../../../../@lib/embedding/src/embedding.service";

@Injectable()
export class MemoryRetrievalService {
  constructor(
    private factDao: MemoryFactDao,
    private embeddingDao: MemoryEmbeddingDao,
    private embeddingService: EmbeddingService,
  ) {}

  async retrieve(userId: string, query: string) {
    const [facts, relevantMemories] = await Promise.all([
      this.factDao.findActiveByUser(userId, 30),
      this.retrieveSimilarMemories(userId, query),
    ]);

    return { facts, relevantMemories };
  }

  private async retrieveSimilarMemories(userId: string, query: string) {
    try {
      const queryEmbedding = await this.embeddingService.embed(query);
      return this.embeddingDao.findSimilar(userId, queryEmbedding, 5, 0.3);
    } catch {
      return [];
    }
  }
}
