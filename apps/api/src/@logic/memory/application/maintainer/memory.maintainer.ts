import { Injectable } from "@nestjs/common";
import { FactExtractionService } from "../service/fact-extraction.service";
import { MemoryRetrievalService } from "../service/memory-retrieval.service";

@Injectable()
export class MemoryMaintainer {
  constructor(
    private factExtraction: FactExtractionService,
    private memoryRetrieval: MemoryRetrievalService,
  ) {}

  async extractFacts(userId: string, lessonId: string, userMessage: string, history: any[]) {
    return this.factExtraction.extractAndSave(userId, lessonId, userMessage, history);
  }

  async getRelevantMemories(userId: string, query: string) {
    return this.memoryRetrieval.retrieve(userId, query);
  }
}
