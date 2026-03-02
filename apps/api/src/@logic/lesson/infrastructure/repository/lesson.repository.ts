import { Injectable } from "@nestjs/common";
import { LessonDao } from "../dao/lesson.dao";
import { LessonMessageDao } from "../dao/lesson-message.dao";
import { Transaction } from "../../../../@shared/shared-cls/transaction";

@Injectable()
export class LessonRepository {
  constructor(
    private lessonDao: LessonDao,
    private messageDao: LessonMessageDao,
  ) {}

  @Transaction()
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
