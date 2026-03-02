import { Module } from "@nestjs/common";
import { MemoryMaintainer } from "./application/maintainer/memory.maintainer";
import { FactExtractionService } from "./application/service/fact-extraction.service";
import { MemoryRetrievalService } from "./application/service/memory-retrieval.service";
import { EmotionalContextService } from "./application/service/emotional-context.service";
import { MemoryFactDao } from "./infrastructure/dao/memory-fact.dao";
import { MemoryEmbeddingDao } from "./infrastructure/dao/memory-embedding.dao";
import { FactExtractionBullHandler } from "./infrastructure/bull-handler/fact-extraction.bull-handler";
import { LlmModule } from "../../@lib/llm/src/llm.module";

@Module({
  imports: [LlmModule],
  providers: [
    MemoryMaintainer,
    FactExtractionService,
    MemoryRetrievalService,
    EmotionalContextService,
    MemoryFactDao,
    MemoryEmbeddingDao,
    FactExtractionBullHandler,
  ],
  exports: [MemoryFactDao, MemoryEmbeddingDao, FactExtractionService],
})
export class MemoryModule {}
