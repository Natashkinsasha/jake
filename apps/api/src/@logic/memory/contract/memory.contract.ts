import { Injectable } from "@nestjs/common";
import type { MemoryRetrievalService } from "../application/service/memory-retrieval.service";
import type { MemoryEmbeddingEntity } from "../domain/entity/memory-embedding.entity";
import type { MemoryEmbeddingRepository } from "../infrastructure/repository/memory-embedding.repository";
import type { MemoryFactRepository } from "../infrastructure/repository/memory-fact.repository";
import type { memoryEmbeddingTable } from "../infrastructure/table/memory-embedding.table";

@Injectable()
export class MemoryContract {
  constructor(
    private memoryRetrievalService: MemoryRetrievalService,
    private memoryEmbeddingRepository: MemoryEmbeddingRepository,
    private memoryFactRepository: MemoryFactRepository,
  ) {}

  async retrieve(userId: string, query: string) {
    return this.memoryRetrievalService.retrieve(userId, query);
  }

  async createEmbedding(data: typeof memoryEmbeddingTable.$inferInsert): Promise<MemoryEmbeddingEntity> {
    return this.memoryEmbeddingRepository.create(data);
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.memoryFactRepository.deleteByUser(userId);
    await this.memoryEmbeddingRepository.deleteByUser(userId);
  }
}
