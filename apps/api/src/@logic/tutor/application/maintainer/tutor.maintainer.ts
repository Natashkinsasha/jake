import { Injectable } from "@nestjs/common";
import { TutorDao } from "../../infrastructure/dao/tutor.dao";
import { TutorMapper } from "../mapper/tutor.mapper";

@Injectable()
export class TutorMaintainer {
  constructor(
    private tutorDao: TutorDao,
    private tutorMapper: TutorMapper,
  ) {}

  async listActive() {
    const tutors = await this.tutorDao.findActive();
    return tutors.map((t) => this.tutorMapper.toResponse(t));
  }
}
