import { Processor } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { ClsWorkerHost } from "@shared/shared-cls/cls-worker-host";
import { QUEUE_NAMES } from "@shared/shared-job/queue-names";
import type { Job } from "bullmq";
import { ClsService } from "nestjs-cls";
import { LessonMaintainer } from "../../application/maintainer/lesson.maintainer";

// Ends a lesson the student left without pressing "end", once they stayed away long enough.
@Processor(QUEUE_NAMES.LESSON_FINALIZE)
export class LessonFinalizeBullHandler extends ClsWorkerHost {
  private readonly logger = new Logger(LessonFinalizeBullHandler.name);

  constructor(
    protected readonly cls: ClsService,
    private lessonMaintainer: LessonMaintainer,
  ) {
    super();
  }

  async processJob(job: Job<{ userId: string; lessonId: string; scheduledAt: number }>) {
    const { userId, lessonId, scheduledAt } = job.data;
    if (await this.lessonMaintainer.finalizeAbandonedLesson(userId, lessonId, scheduledAt)) {
      this.logger.log(`Finalized lesson ${lessonId}: the student left without ending it`);
    }
  }
}
