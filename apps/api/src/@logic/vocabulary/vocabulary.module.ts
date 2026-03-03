import { Module } from "@nestjs/common";
import { VocabularyController } from "./presentation/controller/vocabulary.controller";
import { VocabularyMaintainer } from "./application/maintainer/vocabulary.maintainer";
import { SpacedRepetitionService } from "./application/service/spaced-repetition.service";
import { VocabularyRepository } from "./infrastructure/repository/vocabulary.repository";
import { ReviewReminderBullHandler } from "./infrastructure/bull-handler/review-reminder.bull-handler";
import { VocabularyContract } from "./contract/vocabulary.contract";
import { SharedDrizzlePgModule } from "../../@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedAuthModule } from "../../@shared/shared-auth/shared-auth.module";
import { JobModule } from "../../@lib/job/src";
import { QUEUE_NAMES } from "../../@shared/shared-job/queue-names";

@Module({
  imports: [SharedDrizzlePgModule, SharedAuthModule, JobModule.registerQueue({ name: QUEUE_NAMES.REVIEW_REMINDER })],
  controllers: [VocabularyController],
  providers: [
    VocabularyMaintainer,
    SpacedRepetitionService,
    VocabularyRepository,
    ReviewReminderBullHandler,
    VocabularyContract,
  ],
  exports: [VocabularyContract],
})
export class VocabularyModule {}
