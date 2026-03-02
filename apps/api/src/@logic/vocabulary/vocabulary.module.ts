import { Module } from "@nestjs/common";
import { VocabularyController } from "./presentation/controller/vocabulary.controller";
import { VocabularyMaintainer } from "./application/maintainer/vocabulary.maintainer";
import { SpacedRepetitionService } from "./application/service/spaced-repetition.service";
import { VocabularyDao } from "./infrastructure/dao/vocabulary.dao";
import { ReviewReminderBullHandler } from "./infrastructure/bull-handler/review-reminder.bull-handler";

@Module({
  controllers: [VocabularyController],
  providers: [
    VocabularyMaintainer,
    SpacedRepetitionService,
    VocabularyDao,
    ReviewReminderBullHandler,
  ],
  exports: [VocabularyDao],
})
export class VocabularyModule {}
