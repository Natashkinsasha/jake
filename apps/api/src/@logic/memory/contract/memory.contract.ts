import { Injectable } from "@nestjs/common";
import { MemoryRetrievalService } from "../application/service/memory-retrieval.service";
import { MemoryEmbeddingRepository } from "../infrastructure/repository/memory-embedding.repository";
import { memoryEmbeddingTable } from "../infrastructure/table/memory-embedding.table";
import { MemoryEmbeddingEntity } from "../domain/entity/memory-embedding.entity";

@Injectable()
export class MemoryContract {
  constructor(
    private memoryRetrievalService: MemoryRetrievalService,
    private memoryEmbeddingRepository: MemoryEmbeddingRepository,
  ) {}

  async retrieve(userId: string, query: string) {
    return this.memoryRetrievalService.retrieve(userId, query);
  }

  async createEmbedding(data: typeof memoryEmbeddingTable.$inferInsert): Promise<MemoryEmbeddingEntity> {
    return this.memoryEmbeddingRepository.create(data);
  }
}
