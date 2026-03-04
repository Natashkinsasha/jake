import { Module } from "@nestjs/common";
import { LessonController } from "./presentation/controller/lesson.controller";
import { LessonGateway } from "./presentation/gateway/lesson.gateway";
import { LessonMaintainer } from "./application/maintainer/lesson.maintainer";
import { LessonContextService } from "./application/service/lesson-context.service";
import { LessonResponseService } from "./application/service/lesson-response.service";
import { ExerciseParserService } from "./application/service/exercise-parser.service";
import { AudioPipelineService } from "./application/service/audio-pipeline.service";
import { StreamingPipelineService } from "./application/service/streaming-pipeline.service";
import { LessonSessionService } from "./application/service/lesson-session.service";
import { LessonMapper } from "./application/mapper/lesson.mapper";
import { LessonRepository } from "./infrastructure/repository/lesson.repository";
import { LessonMessageRepository } from "./infrastructure/repository/lesson-message.repository";
import { PostLessonBullHandler } from "./infrastructure/bull-handler/post-lesson.bull-handler";
import { LlmModule } from "../llm/src/llm.module";
import { VoiceModule } from "../voice/src/voice.module";
import { EmbeddingModule } from "../embedding/src/embedding.module";
import { SharedAuthModule } from "../../@shared/shared-auth/shared-auth.module";
import { SharedDrizzlePgModule } from "../../@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedWsModule } from "../../@shared/shared-ws/shared-ws.module";
import { SharedRedisModule } from "../../@shared/shared-redis/shared-redis.module";
import { JobModule } from "../../@lib/job/src";
import { QUEUE_NAMES } from "../../@shared/shared-job/queue-names";
import { AuthModule } from "../auth/auth.module";
import { TutorModule } from "../tutor/tutor.module";
import { MemoryModule } from "../memory/memory.module";
import { VocabularyModule } from "../vocabulary/vocabulary.module";
import { ProgressModule } from "../progress/progress.module";

@Module({
  imports: [
    LlmModule,
    VoiceModule,
    EmbeddingModule,
    SharedAuthModule,
    SharedDrizzlePgModule,
    SharedWsModule,
    SharedRedisModule,
    JobModule.registerQueue({ name: QUEUE_NAMES.POST_LESSON }),
    JobModule.registerQueue({ name: QUEUE_NAMES.FACT_EXTRACTION }),
    AuthModule,
    TutorModule,
    MemoryModule,
    VocabularyModule,
    ProgressModule,
  ],
  controllers: [LessonController],
  providers: [
    LessonGateway,
    LessonMaintainer,
    LessonContextService,
    LessonResponseService,
    ExerciseParserService,
    AudioPipelineService,
    StreamingPipelineService,
    LessonSessionService,
    LessonMapper,
    LessonRepository,
    LessonMessageRepository,
    PostLessonBullHandler,
  ],
})
export class LessonModule {}
