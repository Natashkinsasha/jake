import { Module } from "@nestjs/common";
import { MemoryMaintainer } from "./application/maintainer/memory.maintainer";
import { FactExtractionService } from "./application/service/fact-extraction.service";
import { MemoryRetrievalService } from "./application/service/memory-retrieval.service";
import { EmotionalContextService } from "./application/service/emotional-context.service";
import { MemoryFactRepository } from "./infrastructure/repository/memory-fact.repository";
import { MemoryEmbeddingRepository } from "./infrastructure/repository/memory-embedding.repository";
import { FactExtractionBullHandler } from "./infrastructure/bull-handler/fact-extraction.bull-handler";
import { MemoryContract } from "./contract/memory.contract";
import { LlmModule } from "../llm/src/llm.module";
import { EmbeddingModule } from "../embedding/src/embedding.module";
import { SharedDrizzlePgModule } from "../../@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { JobModule } from "../../@lib/job/src";
import { QUEUE_NAMES } from "../../@shared/shared-job/queue-names";

@Module({
  imports: [LlmModule, EmbeddingModule, SharedDrizzlePgModule, JobModule.registerQueue({ name: QUEUE_NAMES.FACT_EXTRACTION })],
  providers: [
    MemoryMaintainer,
    FactExtractionService,
    MemoryRetrievalService,
    EmotionalContextService,
    MemoryFactRepository,
    MemoryEmbeddingRepository,
    FactExtractionBullHandler,
    MemoryContract,
  ],
  exports: [MemoryContract],
})
export class MemoryModule {}
