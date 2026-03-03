import { Injectable, NotFoundException } from "@nestjs/common";
import { HomeworkRepository } from "../../infrastructure/repository/homework.repository";
import { HomeworkCheckerService } from "../service/homework-checker.service";

@Injectable()
export class HomeworkMaintainer {
  constructor(
    private homeworkRepository: HomeworkRepository,
    private checker: HomeworkCheckerService,
  ) {}

  async listHomework(userId: string) {
    return this.homeworkRepository.findByUser(userId);
  }

  async getById(id: string) {
    return this.homeworkRepository.findById(id);
  }

  async submit(id: string, answers: Record<string, string>) {
    const homework = await this.homeworkRepository.findById(id);
    if (!homework) throw new NotFoundException("Homework not found");

    const score = this.checker.check(homework.exercises, answers);
    await this.homeworkRepository.complete(id, score);
    return { score };
  }
}
