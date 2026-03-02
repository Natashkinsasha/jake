import { Module } from "@nestjs/common";
import { TutorController } from "./presentation/controller/tutor.controller";
import { TutorMaintainer } from "./application/maintainer/tutor.maintainer";
import { TutorMapper } from "./application/mapper/tutor.mapper";
import { TutorDao } from "./infrastructure/dao/tutor.dao";
import { UserTutorDao } from "./infrastructure/dao/user-tutor.dao";

@Module({
  controllers: [TutorController],
  providers: [TutorMaintainer, TutorMapper, TutorDao, UserTutorDao],
  exports: [TutorDao, UserTutorDao],
})
export class TutorModule {}
