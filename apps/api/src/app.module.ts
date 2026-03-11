import { Module } from "@nestjs/common";
import { SharedJobBoardModule } from "@shared/shared-job-board";
import { AuthModule } from "./@logic/auth/auth.module";
// @logic
import { HealthModule } from "./@logic/health/health.module";
import { LessonModule } from "./@logic/lesson/lesson.module";
import { MemoryModule } from "./@logic/memory/memory.module";
import { ProgressModule } from "./@logic/progress/progress.module";
import { TutorModule } from "./@logic/tutor/tutor.module";
import { VocabularyModule } from "./@logic/vocabulary/vocabulary.module";
import { SharedAuthModule } from "./@shared/shared-auth/shared-auth.module";
import { SharedClsModule } from "./@shared/shared-cls/shared-cls.module";
// @shared
import { SharedConfigModule } from "./@shared/shared-config/shared-config.module";
import { SharedDrizzlePgModule } from "./@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedJobModule } from "./@shared/shared-job/shared-job.module";
import { SharedRedisModule } from "./@shared/shared-redis/shared-redis.module";
import { SharedWsModule } from "./@shared/shared-ws/shared-ws.module";
import { SharedZodHttpModule } from "./@shared/shared-zod-http/shared-zod-http.module";

@Module({
  imports: [
    // Shared infrastructure
    SharedConfigModule,
    SharedDrizzlePgModule,
    SharedClsModule,
    SharedRedisModule,
    SharedJobModule,
    SharedJobBoardModule,
    SharedZodHttpModule,
    SharedAuthModule,
    SharedWsModule,

    // Domain modules
    HealthModule,
    AuthModule,
    TutorModule,
    MemoryModule,
    VocabularyModule,
    ProgressModule,
    LessonModule,
  ],
})
export class AppModule {}
