import { Injectable } from "@nestjs/common";
import type { TutorService } from "../application/service/tutor.service";
import type { TutorGender, TutorNationality, TutorProfile, TutorVoice } from "../domain/tutor-types";

@Injectable()
export class TutorContract {
  constructor(private readonly tutorService: TutorService) {}

  getProfiles(): TutorProfile[] {
    return this.tutorService.getProfiles();
  }

  getProfile(nationality: TutorNationality, gender: TutorGender): TutorProfile {
    return this.tutorService.getProfile(nationality, gender);
  }

  getVoices(gender: TutorGender): TutorVoice[] {
    return this.tutorService.getVoices(gender);
  }

  getDefaultVoiceId(gender: TutorGender): string {
    return this.tutorService.getDefaultVoiceId(gender);
  }
}
