import { Module } from "@nestjs/common";
import { VocabularyController } from "./presentation/controller/vocabulary.controller";
import { VocabularyMaintainer } from "./application/maintainer/vocabulary.maintainer";
import { SpacedRepetitionService } from "./application/service/spaced-repetition.service";
import { VocabularyDao } from "./infrastructure/dao/vocabulary.dao";
import { ReviewReminderBullHandler } from "./infrastructure/bull-handler/review-reminder.bull-handler";
import { SharedDrizzlePgModule } from "../../@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedAuthModule } from "../../@shared/shared-auth/shared-auth.module";
import { SharedJobModule } from "../../@shared/shared-job/shared-job.module";

@Module({
  imports: [SharedDrizzlePgModule, SharedAuthModule, SharedJobModule],
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
