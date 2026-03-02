import { Injectable } from "@nestjs/common";
import { LessonDao } from "../dao/lesson.dao";
import { LessonMessageDao } from "../dao/lesson-message.dao";

@Injectable()
export class LessonRepository {
  constructor(
    private lessonDao: LessonDao,
    private messageDao: LessonMessageDao,
  ) {}

  async createWithGreeting(
    lessonData: Parameters<LessonDao["create"]>[0],
    greeting: string,
  ) {
    const lesson = await this.lessonDao.create(lessonData);
    await this.messageDao.create({
      lessonId: lesson.id,
      role: "tutor",
      content: greeting,
    });
    return lesson;
  }
}
