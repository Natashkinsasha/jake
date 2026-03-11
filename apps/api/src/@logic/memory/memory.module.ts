import { JobModule } from "@lib/job/src";
import { Module } from "@nestjs/common";
import { SharedClsModule } from "@shared/shared-cls/shared-cls.module";
import { SharedDrizzlePgModule } from "@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { QUEUE_NAMES } from "@shared/shared-job/queue-names";
import { EmbeddingModule } from "../embedding/src/embedding.module";
import { LlmModule } from "../llm/src/llm.module";
import { MemoryMaintainer } from "./application/maintainer/memory.maintainer";
import { EmotionalContextService } from "./application/service/emotional-context.service";
import { FactExtractionService } from "./application/service/fact-extraction.service";
import { MemoryRetrievalService } from "./application/service/memory-retrieval.service";
import { MemoryContract } from "./contract/memory.contract";
import { FactExtractionBullHandler } from "./infrastructure/bull-handler/fact-extraction.bull-handler";
import { MemoryEmbeddingRepository } from "./infrastructure/repository/memory-embedding.repository";
import { MemoryFactRepository } from "./infrastructure/repository/memory-fact.repository";

@Module({
  imports: [
    LlmModule,
    EmbeddingModule,
    SharedDrizzlePgModule,
    SharedClsModule,
    JobModule.registerQueue({ name: QUEUE_NAMES.FACT_EXTRACTION }),
  ],
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
