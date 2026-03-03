import { Module } from "@nestjs/common";
import { ProgressController } from "./presentation/controller/progress.controller";
import { ProgressMaintainer } from "./application/maintainer/progress.maintainer";
import { LevelAssessmentService } from "./application/service/level-assessment.service";
import { GrammarProgressRepository } from "./infrastructure/repository/grammar-progress.repository";
import { ProgressContract } from "./contract/progress.contract";
import { SharedDrizzlePgModule } from "../../@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedAuthModule } from "../../@shared/shared-auth/shared-auth.module";

@Module({
  imports: [SharedDrizzlePgModule, SharedAuthModule],
  controllers: [ProgressController],
  providers: [ProgressMaintainer, LevelAssessmentService, GrammarProgressRepository, ProgressContract],
  exports: [ProgressContract],
})
export class ProgressModule {}
