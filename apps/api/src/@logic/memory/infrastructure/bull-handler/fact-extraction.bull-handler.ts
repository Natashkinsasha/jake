import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { FactExtractionService } from "../../application/service/fact-extraction.service";

@Processor("fact-extraction")
export class FactExtractionBullHandler extends WorkerHost {
  constructor(private factExtraction: FactExtractionService) {
    super();
  }

  async process(job: Job) {
    const { userId, lessonId, userMessage, history } = job.data;
    await this.factExtraction.extractAndSave(userId, lessonId, userMessage, history);
  }
}
