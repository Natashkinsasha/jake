import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

// @shared
import { SharedConfigModule } from "./@shared/shared-config/shared-config.module";
import { SharedDrizzlePgModule } from "./@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedClsModule } from "./@shared/shared-cls/shared-cls.module";
import { SharedRedisModule } from "./@shared/shared-redis/shared-redis.module";
import { SharedJobModule } from "./@shared/shared-job/shared-job.module";
import { SharedZodHttpModule } from "./@shared/shared-zod-http/shared-zod-http.module";
import { SharedWsModule } from "./@shared/shared-ws/shared-ws.module";
import { SharedAuthModule } from "./@shared/shared-auth/shared-auth.module";

// @logic
import { HealthModule } from "./@logic/health/health.module";
import { AuthModule } from "./@logic/auth/auth.module";
import { TutorModule } from "./@logic/tutor/tutor.module";
import { LessonModule } from "./@logic/lesson/lesson.module";
import { MemoryModule } from "./@logic/memory/memory.module";
import { HomeworkModule } from "./@logic/homework/homework.module";
import { VocabularyModule } from "./@logic/vocabulary/vocabulary.module";
import { ProgressModule } from "./@logic/progress/progress.module";

@Module({
  imports: [
    // Shared infrastructure
    SharedConfigModule,
    SharedDrizzlePgModule,
    SharedClsModule,
    SharedRedisModule,
    SharedJobModule,
SharedZodHttpModule,
    SharedWsModule,
    SharedAuthModule,
    JwtModule.register({ global: true, secret: process.env.JWT_SECRET }),

    // Domain modules
    HealthModule,
    AuthModule,
    TutorModule,
    LessonModule,
    MemoryModule,
    HomeworkModule,
    VocabularyModule,
    ProgressModule,
  ],
})
export class AppModule {}
