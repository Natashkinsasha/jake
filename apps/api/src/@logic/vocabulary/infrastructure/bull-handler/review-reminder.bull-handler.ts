import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE_NAMES } from "../../../../@shared/shared-job/queue-names";

@Processor(QUEUE_NAMES.REVIEW_REMINDER)
export class ReviewReminderBullHandler extends WorkerHost {
  process(job: Job<{ userId: string }>) {
    const { userId } = job.data;
    console.log(`Review reminder for user ${userId}`);
    return Promise.resolve();
  }
}
