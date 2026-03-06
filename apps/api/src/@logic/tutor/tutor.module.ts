import { Module } from "@nestjs/common";
import { SharedDrizzlePgModule } from "@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedAuthModule } from "@shared/shared-auth/shared-auth.module";
import { TutorController } from "./presentation/controller/tutor.controller";
import { TutorMaintainer } from "./application/maintainer/tutor.maintainer";
import { TutorMapper } from "./application/mapper/tutor.mapper";
import { TutorRepository } from "./infrastructure/repository/tutor.repository";
import { UserTutorRepository } from "./infrastructure/repository/user-tutor.repository";
import { TutorContract } from "./contract/tutor.contract";

@Module({
  imports: [SharedDrizzlePgModule, SharedAuthModule],
  controllers: [TutorController],
  providers: [TutorMaintainer, TutorMapper, TutorRepository, UserTutorRepository, TutorContract],
  exports: [TutorContract],
})
export class TutorModule {}
