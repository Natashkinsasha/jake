import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ProgressMaintainer } from "../../application/maintainer/progress.maintainer";
import { JwtAuthGuard } from "../../../../@shared/shared-auth/jwt-auth.guard";

@Controller("progress")
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private progressMaintainer: ProgressMaintainer) {}

  @Get()
  async getOverview(@Query("userId") userId: string) {
    return this.progressMaintainer.getOverview(userId);
  }
}
