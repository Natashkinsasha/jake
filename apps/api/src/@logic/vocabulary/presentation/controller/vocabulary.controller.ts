import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { VocabularyMaintainer } from "../../application/maintainer/vocabulary.maintainer";
import { JwtAuthGuard } from "../../../../@shared/shared-auth/jwt-auth.guard";

@Controller("vocabulary")
@UseGuards(JwtAuthGuard)
export class VocabularyController {
  constructor(private vocabularyMaintainer: VocabularyMaintainer) {}

  @Get()
  async list(@Query("userId") userId: string) {
    return this.vocabularyMaintainer.listByUser(userId);
  }

  @Get("review")
  async getForReview(@Query("userId") userId: string) {
    return this.vocabularyMaintainer.getForReview(userId);
  }
}
