import { Controller, Get, UseGuards } from "@nestjs/common";
import { VocabularyMaintainer } from "../../application/maintainer/vocabulary.maintainer";
import { JwtAuthGuard } from "../../../../@shared/shared-auth/jwt-auth.guard";
import { CurrentUserId } from "../../../../@shared/shared-auth/current-user.decorator";

@Controller("vocabulary")
@UseGuards(JwtAuthGuard)
export class VocabularyController {
  constructor(private vocabularyMaintainer: VocabularyMaintainer) {}

  @Get()
  async list(@CurrentUserId() userId: string) {
    return this.vocabularyMaintainer.listByUser(userId);
  }

  @Get("review")
  async getForReview(@CurrentUserId() userId: string) {
    return this.vocabularyMaintainer.getForReview(userId);
  }
}
