import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE_NAMES } from "../../../../@shared/shared-job/queue-names";

@Processor(QUEUE_NAMES.REVIEW_REMINDER)
export class ReviewReminderBullHandler extends WorkerHost {
  async process(job: Job) {
    const { userId } = job.data;
    console.log(`Review reminder for user ${userId}`);
  }
}
