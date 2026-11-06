import { Injectable } from "@nestjs/common";
import { LessonRepository } from "../infrastructure/repository/lesson.repository";

@Injectable()
export class LessonContract {
  constructor(private lessonRepository: LessonRepository) {}

  async deleteByUser(userId: string): Promise<void> {
    return this.lessonRepository.deleteByUser(userId);
  }
}
