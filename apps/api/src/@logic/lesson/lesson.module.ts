import { JobModule } from "@lib/job/src";
import { forwardRef, Module } from "@nestjs/common";
import { SharedAuthModule } from "@shared/shared-auth/shared-auth.module";
import { SharedClsModule } from "@shared/shared-cls/shared-cls.module";
import { SharedConfigModule } from "@shared/shared-config/shared-config.module";
import { SharedDrizzlePgModule } from "@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { QUEUE_NAMES } from "@shared/shared-job/queue-names";
import { SharedRedisModule } from "@shared/shared-redis/shared-redis.module";
import { SharedWsModule } from "@shared/shared-ws/shared-ws.module";
import { AuthModule } from "../auth/auth.module";
import { EmbeddingModule } from "../embedding/src/embedding.module";
import { LlmModule } from "../llm/src/llm.module";
import { MemoryModule } from "../memory/memory.module";
import { ProgressModule } from "../progress/progress.module";
import { VocabularyModule } from "../vocabulary/vocabulary.module";
import { LessonMaintainer } from "./application/maintainer/lesson.maintainer";
import { LessonMapper } from "./application/mapper/lesson.mapper";
import { LessonContextService } from "./application/service/lesson-context.service";
import { LessonResponseService } from "./application/service/lesson-response.service";
import { LessonSessionService } from "./application/service/lesson-session.service";
import { StreamingPipelineService } from "./application/service/streaming-pipeline.service";
import { VoicePrintService } from "./application/service/voice-print.service";
import { LessonContract } from "./contract/lesson.contract";
import { PostLessonBullHandler } from "./infrastructure/bull-handler/post-lesson.bull-handler";
import { LessonRepository } from "./infrastructure/repository/lesson.repository";
import { LessonMessageRepository } from "./infrastructure/repository/lesson-message.repository";
import { VoicePrintRepository } from "./infrastructure/repository/voice-print.repository";
import { LessonController } from "./presentation/controller/lesson.controller";
import { LessonGateway } from "./presentation/gateway/lesson.gateway";

@Module({
  imports: [
    LlmModule,
    EmbeddingModule,
    SharedAuthModule,
    SharedDrizzlePgModule,
    SharedWsModule,
    SharedRedisModule,
    SharedClsModule,
    JobModule.registerQueue({ name: QUEUE_NAMES.POST_LESSON }),
    JobModule.registerQueue({ name: QUEUE_NAMES.FACT_EXTRACTION }),
    forwardRef(() => AuthModule),
    MemoryModule,
    VocabularyModule,
    ProgressModule,
    SharedConfigModule,
  ],
  controllers: [LessonController],
  providers: [
    LessonGateway,
    LessonMaintainer,
    LessonContextService,
    LessonResponseService,
    StreamingPipelineService,
    LessonSessionService,
    LessonMapper,
    LessonRepository,
    LessonMessageRepository,
    PostLessonBullHandler,
    VoicePrintService,
    VoicePrintRepository,
    LessonContract,
  ],
  exports: [LessonContract],
})
export class LessonModule {}
