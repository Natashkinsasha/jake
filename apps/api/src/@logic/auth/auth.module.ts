import { forwardRef, Module } from "@nestjs/common";
import { SharedAuthModule } from "@shared/shared-auth/shared-auth.module";
import { SharedClsModule } from "@shared/shared-cls/shared-cls.module";
import { SharedDrizzlePgModule } from "@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { LessonModule } from "../lesson/lesson.module";
import { MemoryModule } from "../memory/memory.module";
import { ProgressModule } from "../progress/progress.module";
import { VocabularyModule } from "../vocabulary/vocabulary.module";
import { AuthMaintainer } from "./application/maintainer/auth.maintainer";
import { JwtTokenService } from "./application/service/jwt-token.service";
import { AuthContract } from "./contract/auth.contract";
import { UserRepository } from "./infrastructure/repository/user.repository";
import { AuthController } from "./presentation/controller/auth.controller";

@Module({
  imports: [
    SharedDrizzlePgModule,
    SharedAuthModule,
    SharedClsModule,
    forwardRef(() => LessonModule),
    MemoryModule,
    VocabularyModule,
    ProgressModule,
  ],
  controllers: [AuthController],
  providers: [AuthMaintainer, JwtTokenService, UserRepository, AuthContract],
  exports: [AuthContract],
})
export class AuthModule {}
