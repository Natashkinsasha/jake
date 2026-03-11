import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "@shared/shared-auth/jwt-auth.guard";
import type { TutorContract } from "../../contract/tutor.contract";
import type { TutorGender } from "../../domain/tutor-types";

@Controller("tutor")
@UseGuards(JwtAuthGuard)
export class TutorController {
  constructor(private readonly tutorContract: TutorContract) {}

  @Get("profiles")
  getProfiles() {
    return this.tutorContract.getProfiles().map((p) => ({
      gender: p.gender,
      nationality: p.nationality,
      description: p.description,
      traits: p.traits,
    }));
  }

  @Get("voices")
  getVoices(@Query("gender") gender: TutorGender) {
    return this.tutorContract.getVoices(gender);
  }
}
