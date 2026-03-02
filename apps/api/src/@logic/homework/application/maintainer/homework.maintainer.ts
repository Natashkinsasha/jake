import { Injectable } from "@nestjs/common";
import { HomeworkDao } from "../../infrastructure/dao/homework.dao";
import { HomeworkCheckerService } from "../service/homework-checker.service";

@Injectable()
export class HomeworkMaintainer {
  constructor(
    private homeworkDao: HomeworkDao,
    private checker: HomeworkCheckerService,
  ) {}

  async listHomework(userId: string) {
    return this.homeworkDao.findByUser(userId);
  }

  async getById(id: string) {
    return this.homeworkDao.findById(id);
  }

  async submit(id: string, answers: Record<string, string>) {
    const homework = await this.homeworkDao.findById(id);
    if (!homework) throw new Error("Homework not found");

    const score = this.checker.check(homework.exercises, answers);
    await this.homeworkDao.complete(id, score);
    return { score };
  }
}
