import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { FactExtractionService } from "../../application/service/fact-extraction.service";
import { QUEUE_NAMES } from "../../../../@shared/shared-job/queue-names";
import type { LlmMessage } from "../../../llm/src/anthropic-llm.provider";

@Processor(QUEUE_NAMES.FACT_EXTRACTION)
export class FactExtractionBullHandler extends WorkerHost {
  private readonly logger = new Logger(FactExtractionBullHandler.name);

  constructor(private factExtraction: FactExtractionService) {
    super();
  }

  async process(job: Job<{ userId: string; lessonId: string; userMessage: string; history: LlmMessage[] }>) {
    const { userId, lessonId, userMessage, history } = job.data;
    this.logger.debug(`Extracting facts for lesson ${lessonId}`);

    try {
      await this.factExtraction.extractAndSave(userId, lessonId, userMessage, history);
      this.logger.debug(`Fact extraction completed for lesson ${lessonId}`);
    } catch (error) {
      this.logger.error(
        `Fact extraction failed for lesson ${lessonId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
