import { Module } from "@nestjs/common";
import { HomeworkController } from "./presentation/controller/homework.controller";
import { HomeworkMaintainer } from "./application/maintainer/homework.maintainer";
import { HomeworkGeneratorService } from "./application/service/homework-generator.service";
import { HomeworkCheckerService } from "./application/service/homework-checker.service";
import { HomeworkMapper } from "./application/mapper/homework.mapper";
import { HomeworkDao } from "./infrastructure/dao/homework.dao";
import { HomeworkGenerationBullHandler } from "./infrastructure/bull-handler/homework-generation.bull-handler";
import { LlmModule } from "../../@lib/llm/src/llm.module";

@Module({
  imports: [LlmModule],
  controllers: [HomeworkController],
  providers: [
    HomeworkMaintainer,
    HomeworkGeneratorService,
    HomeworkCheckerService,
    HomeworkMapper,
    HomeworkDao,
    HomeworkGenerationBullHandler,
  ],
  exports: [HomeworkDao, HomeworkGeneratorService],
})
export class HomeworkModule {}
