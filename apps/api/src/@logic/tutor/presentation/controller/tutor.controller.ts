import { Controller, Get, UseGuards } from "@nestjs/common";
import { TutorMaintainer } from "../../application/maintainer/tutor.maintainer";
import { JwtAuthGuard } from "../../../../@shared/shared-auth/jwt-auth.guard";

@Controller("tutors")
@UseGuards(JwtAuthGuard)
export class TutorController {
  constructor(private tutorMaintainer: TutorMaintainer) {}

  @Get()
  async list() {
    return this.tutorMaintainer.listActive();
  }
}
