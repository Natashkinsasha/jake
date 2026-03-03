import { Injectable } from "@nestjs/common";
import { HomeworkGeneratorService } from "../application/service/homework-generator.service";

@Injectable()
export class HomeworkContract {
  constructor(private homeworkGenerator: HomeworkGeneratorService) {}

  async generateAndSave(
    lessonId: string,
    userId: string,
    summary: Parameters<HomeworkGeneratorService["generateAndSave"]>[2],
    preferences: Parameters<HomeworkGeneratorService["generateAndSave"]>[3],
  ): Promise<void> {
    return this.homeworkGenerator.generateAndSave(lessonId, userId, summary, preferences);
  }
}
