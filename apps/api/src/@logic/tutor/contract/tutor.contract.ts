import { Injectable } from "@nestjs/common";
import { TutorRepository } from "../infrastructure/repository/tutor.repository";
import { UserTutorRepository } from "../infrastructure/repository/user-tutor.repository";
import { TutorEntity } from "../domain/entity/tutor.entity";
import { UserTutorEntity, UserTutorWithTutor } from "../domain/entity/user-tutor.entity";

@Injectable()
export class TutorContract {
  constructor(
    private tutorRepository: TutorRepository,
    private userTutorRepository: UserTutorRepository,
  ) {}

  async findActiveTutors(): Promise<TutorEntity[]> {
    return this.tutorRepository.findActive();
  }

  async findActiveUserTutor(userId: string): Promise<UserTutorWithTutor | null> {
    return this.userTutorRepository.findActiveByUser(userId);
  }

  async selectTutor(userId: string, tutorId: string): Promise<UserTutorEntity> {
    return this.userTutorRepository.selectTutor(userId, tutorId);
  }
}
