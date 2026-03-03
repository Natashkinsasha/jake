import { Injectable } from "@nestjs/common";
import { TutorRepository } from "../../infrastructure/repository/tutor.repository";
import { TutorMapper } from "../mapper/tutor.mapper";

@Injectable()
export class TutorMaintainer {
  constructor(
    private tutorRepository: TutorRepository,
    private tutorMapper: TutorMapper,
  ) {}

  async listActive() {
    const tutors = await this.tutorRepository.findActive();
    return tutors.map((t) => this.tutorMapper.toResponse(t));
  }
}
