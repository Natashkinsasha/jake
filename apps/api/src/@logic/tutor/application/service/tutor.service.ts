import { Injectable } from "@nestjs/common";
import { getTutorProfile, TUTOR_PROFILES } from "../../domain/tutor-profiles";
import type { TutorGender, TutorNationality, TutorProfile, TutorVoice } from "../../domain/tutor-types";
import { getDefaultVoice, getVoicesByGender } from "../../domain/tutor-voices";

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
