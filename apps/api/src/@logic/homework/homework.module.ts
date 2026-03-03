import { Module } from "@nestjs/common";
import { HomeworkController } from "./presentation/controller/homework.controller";
import { HomeworkMaintainer } from "./application/maintainer/homework.maintainer";
import { HomeworkGeneratorService } from "./application/service/homework-generator.service";
import { HomeworkCheckerService } from "./application/service/homework-checker.service";
import { HomeworkMapper } from "./application/mapper/homework.mapper";
import { HomeworkRepository } from "./infrastructure/repository/homework.repository";
import { HomeworkGenerationBullHandler } from "./infrastructure/bull-handler/homework-generation.bull-handler";
import { HomeworkContract } from "./contract/homework.contract";
import { LlmModule } from "../../@lib/llm/src/llm.module";
import { SharedDrizzlePgModule } from "../../@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedAuthModule } from "../../@shared/shared-auth/shared-auth.module";
import { JobModule } from "../../@lib/job/src";
import { QUEUE_NAMES } from "../../@shared/shared-job/queue-names";

@Module({
  imports: [LlmModule, SharedDrizzlePgModule, SharedAuthModule, JobModule.registerQueue({ name: QUEUE_NAMES.HOMEWORK_GENERATION })],
  controllers: [HomeworkController],
  providers: [
    HomeworkMaintainer,
    HomeworkGeneratorService,
    HomeworkCheckerService,
    HomeworkMapper,
    HomeworkRepository,
    HomeworkGenerationBullHandler,
    HomeworkContract,
  ],
  exports: [HomeworkContract],
})
export class HomeworkModule {}
