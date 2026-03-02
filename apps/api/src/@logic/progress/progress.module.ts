import { Module } from "@nestjs/common";
import { ProgressController } from "./presentation/controller/progress.controller";
import { ProgressMaintainer } from "./application/maintainer/progress.maintainer";
import { LevelAssessmentService } from "./application/service/level-assessment.service";
import { GrammarProgressDao } from "./infrastructure/dao/grammar-progress.dao";

@Module({
  controllers: [ProgressController],
  providers: [ProgressMaintainer, LevelAssessmentService, GrammarProgressDao],
  exports: [GrammarProgressDao],
})
export class ProgressModule {}
