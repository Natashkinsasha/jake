import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";

@Processor("review-reminder")
export class ReviewReminderBullHandler extends WorkerHost {
  async process(job: Job) {
    const { userId } = job.data;
    console.log(`Review reminder for user ${userId}`);
  }
}
