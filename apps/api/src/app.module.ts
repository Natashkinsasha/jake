import { Module } from "@nestjs/common";
import { SharedJobBoardModule } from "@shared/shared-job-board";
// @shared
import { SharedConfigModule } from "./@shared/shared-config/shared-config.module";
import { SharedClsModule } from "./@shared/shared-cls/shared-cls.module";
import { SharedDrizzlePgModule } from "./@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedRedisModule } from "./@shared/shared-redis/shared-redis.module";
import { SharedJobModule } from "./@shared/shared-job/shared-job.module";
import { SharedZodHttpModule } from "./@shared/shared-zod-http/shared-zod-http.module";
import { SharedAuthModule } from "./@shared/shared-auth/shared-auth.module";
import { SharedWsModule } from "./@shared/shared-ws/shared-ws.module";

// @logic
import { HealthModule } from "./@logic/health/health.module";
import { AuthModule } from "./@logic/auth/auth.module";
import { TutorModule } from "./@logic/tutor/tutor.module";
import { MemoryModule } from "./@logic/memory/memory.module";
import { VocabularyModule } from "./@logic/vocabulary/vocabulary.module";
import { ProgressModule } from "./@logic/progress/progress.module";
import { LessonModule } from "./@logic/lesson/lesson.module";

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
