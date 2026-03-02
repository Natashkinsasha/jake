import { Controller, Get, UseGuards } from "@nestjs/common";
import { ZodSerializerDto } from "nestjs-zod";
import { TutorMaintainer } from "../../application/maintainer/tutor.maintainer";
import { JwtAuthGuard } from "../../../../@shared/shared-auth/jwt-auth.guard";
import { TutorListResponse } from "../dto/response/tutor-list.response";

@Controller("tutors")
@UseGuards(JwtAuthGuard)
export class TutorController {
  constructor(private tutorMaintainer: TutorMaintainer) {}

  @Get()
  @ZodSerializerDto(TutorListResponse)
  async list() {
    return this.tutorMaintainer.listActive();
  }
}
