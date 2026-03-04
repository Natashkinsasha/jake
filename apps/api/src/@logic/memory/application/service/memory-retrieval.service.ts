import { Injectable } from "@nestjs/common";
import { MemoryFactRepository } from "../../infrastructure/repository/memory-fact.repository";
import { MemoryEmbeddingRepository } from "../../infrastructure/repository/memory-embedding.repository";
import { EmbeddingProvider } from "../../../../@lib/provider/src";

@Injectable()
export class MemoryRetrievalService {
  constructor(
    private factRepository: MemoryFactRepository,
    private embeddingRepository: MemoryEmbeddingRepository,
    private embeddingProvider: EmbeddingProvider,
  ) {}

  async retrieve(userId: string, query: string) {
    const [facts, relevantMemories] = await Promise.all([
      this.factRepository.findActiveByUser(userId, 30),
      this.retrieveSimilarMemories(userId, query),
    ]);

    return { facts, relevantMemories };
  }

  private async retrieveSimilarMemories(userId: string, query: string) {
    try {
      const queryEmbedding = await this.embeddingProvider.embed(query);
      return this.embeddingRepository.findSimilar(userId, queryEmbedding, 5, 0.3);
    } catch {
      return [];
    }
  }
}
