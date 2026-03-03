import { Injectable } from "@nestjs/common";
import { TutorEntity } from "../../domain/entity/tutor.entity";
import { TutorListResponse } from "../../presentation/dto/response/tutor-list.response";

@Injectable()
export class TutorMapper {
  toResponse(tutor: TutorEntity): TutorListResponse {
    return {
      id: tutor.id,
      name: tutor.name,
      personality: tutor.personality,
      accent: tutor.accent,
      avatarUrl: tutor.avatarUrl,
      traits: (tutor.traits || []) as string[],
    };
  }
}
