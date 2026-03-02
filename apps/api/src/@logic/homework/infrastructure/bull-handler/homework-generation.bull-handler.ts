import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { HomeworkGeneratorService } from "../../application/service/homework-generator.service";

@Processor("homework-generation")
export class HomeworkGenerationBullHandler extends WorkerHost {
  constructor(private generator: HomeworkGeneratorService) {
    super();
  }

  async process(job: Job) {
    const { lessonId, userId, lessonSummary, userPreferences } = job.data;
    await this.generator.generateAndSave(lessonId, userId, lessonSummary, userPreferences);
  }
}
