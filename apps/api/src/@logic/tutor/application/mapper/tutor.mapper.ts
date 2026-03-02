import { Injectable } from "@nestjs/common";
import { TutorListResponse } from "../../presentation/dto/response/tutor-list.response";

@Injectable()
export class TutorMapper {
  toResponse(tutor: any): TutorListResponse {
    return {
      id: tutor.id,
      name: tutor.name,
      personality: tutor.personality,
      accent: tutor.accent,
      avatarUrl: tutor.avatarUrl,
      traits: tutor.traits || [],
    };
  }
}
