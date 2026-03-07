import { Injectable } from "@nestjs/common";
import { TUTOR_PROFILES, getTutorProfile } from "../../domain/tutor-profiles";
import { getVoicesByGender, getDefaultVoice } from "../../domain/tutor-voices";
import type { TutorGender, TutorNationality, TutorProfile, TutorVoice } from "../../domain/tutor-types";

@Injectable()
export class TutorService {
  getProfiles(): TutorProfile[] {
    return Object.values(TUTOR_PROFILES);
  }

  getProfile(nationality: TutorNationality, gender: TutorGender): TutorProfile {
    return getTutorProfile(nationality, gender);
  }

  getVoices(gender: TutorGender): TutorVoice[] {
    return getVoicesByGender(gender);
  }

  getDefaultVoiceId(gender: TutorGender): string {
    return getDefaultVoice(gender).id;
  }
}
