import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { FactExtractionService } from "../../application/service/fact-extraction.service";

@Processor("fact-extraction")
export class FactExtractionBullHandler extends WorkerHost {
  private readonly logger = new Logger(FactExtractionBullHandler.name);

  constructor(private factExtraction: FactExtractionService) {
    super();
  }

  async process(job: Job) {
    const { userId, lessonId, userMessage, history } = job.data;
    this.logger.debug(`Extracting facts for lesson ${lessonId}`);

    try {
      await this.factExtraction.extractAndSave(userId, lessonId, userMessage, history);
      this.logger.debug(`Fact extraction completed for lesson ${lessonId}`);
    } catch (error) {
      this.logger.error(
        `Fact extraction failed for lesson ${lessonId}: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
