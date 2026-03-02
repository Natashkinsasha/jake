import { Module } from "@nestjs/common";
import { LessonController } from "./presentation/controller/lesson.controller";
import { LessonGateway } from "./presentation/gateway/lesson.gateway";
import { LessonMaintainer } from "./application/maintainer/lesson.maintainer";
import { LessonContextService } from "./application/service/lesson-context.service";
import { LessonResponseService } from "./application/service/lesson-response.service";
import { ExerciseParserService } from "./application/service/exercise-parser.service";
import { AudioPipelineService } from "./application/service/audio-pipeline.service";
import { LessonMapper } from "./application/mapper/lesson.mapper";
import { LessonDao } from "./infrastructure/dao/lesson.dao";
import { LessonMessageDao } from "./infrastructure/dao/lesson-message.dao";
import { LessonRepository } from "./infrastructure/repository/lesson.repository";
import { PostLessonBullHandler } from "./infrastructure/bull-handler/post-lesson.bull-handler";
import { LlmModule } from "../../@lib/llm/src/llm.module";
import { VoiceModule } from "../../@lib/voice/src/voice.module";
import { EmbeddingModule } from "../../@lib/embedding/src/embedding.module";
import { SharedAuthModule } from "../../@shared/shared-auth/shared-auth.module";
import { SharedDrizzlePgModule } from "../../@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedWsModule } from "../../@shared/shared-ws/shared-ws.module";
import { SharedJobModule } from "../../@shared/shared-job/shared-job.module";
import { AuthModule } from "../auth/auth.module";
import { TutorModule } from "../tutor/tutor.module";
import { MemoryModule } from "../memory/memory.module";
import { VocabularyModule } from "../vocabulary/vocabulary.module";
import { ProgressModule } from "../progress/progress.module";
import { HomeworkModule } from "../homework/homework.module";

@Module({
  imports: [
    LlmModule,
    VoiceModule,
    EmbeddingModule,
    SharedAuthModule,
    SharedDrizzlePgModule,
    SharedWsModule,
    SharedJobModule,
    AuthModule,
    TutorModule,
    MemoryModule,
    VocabularyModule,
    ProgressModule,
    HomeworkModule,
  ],
  controllers: [LessonController],
  providers: [
    LessonGateway,
    LessonMaintainer,
    LessonContextService,
    LessonResponseService,
    ExerciseParserService,
    AudioPipelineService,
    LessonMapper,
    LessonDao,
    LessonMessageDao,
    LessonRepository,
    PostLessonBullHandler,
  ],
  exports: [LessonDao],
})
export class LessonModule {}
