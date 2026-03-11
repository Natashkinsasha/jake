import { WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import type { ClsService } from "nestjs-cls";

export abstract class ClsWorkerHost extends WorkerHost {
  protected abstract readonly cls: ClsService;

  async process(job: Job, token?: string): Promise<unknown> {
    return this.cls.run(() => this.processJob(job, token));
  }

  abstract processJob(job: Job, token?: string): Promise<unknown>;
}
