import { Controller, Get, UseGuards } from "@nestjs/common";
import { ProgressMaintainer } from "../../application/maintainer/progress.maintainer";
import { JwtAuthGuard } from "../../../../@shared/shared-auth/jwt-auth.guard";
import { CurrentUser } from "../../../../@shared/shared-auth/current-user.decorator";

@Controller("progress")
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private progressMaintainer: ProgressMaintainer) {}

  @Get()
  async getOverview(@CurrentUser() userId: string) {
    return this.progressMaintainer.getOverview(userId);
  }
}
