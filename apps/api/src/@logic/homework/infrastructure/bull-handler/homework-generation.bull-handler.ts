import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { HomeworkGeneratorService } from "../../application/service/homework-generator.service";
import { QUEUE_NAMES } from "../../../../@shared/shared-job/queue-names";

interface HomeworkGenerationJobData {
  lessonId: string;
  userId: string;
  lessonSummary: Parameters<HomeworkGeneratorService["generateAndSave"]>[2];
  userPreferences: Parameters<HomeworkGeneratorService["generateAndSave"]>[3];
}

@Processor(QUEUE_NAMES.HOMEWORK_GENERATION)
export class HomeworkGenerationBullHandler extends WorkerHost {
  constructor(private generator: HomeworkGeneratorService) {
    super();
  }

  async process(job: Job<HomeworkGenerationJobData>) {
    const { lessonId, userId, lessonSummary, userPreferences } = job.data;
    await this.generator.generateAndSave(lessonId, userId, lessonSummary, userPreferences);
  }
}
