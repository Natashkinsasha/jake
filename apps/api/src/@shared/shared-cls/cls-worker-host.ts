import { WorkerHost } from "@nestjs/bullmq";
import { ClsService } from "nestjs-cls";
import { Job } from "bullmq";

export abstract class ClsWorkerHost extends WorkerHost {
  protected abstract readonly cls: ClsService;

  async process(job: Job, token?: string): Promise<any> {
    return this.cls.run(() => this.processJob(job, token));
  }

  abstract processJob(job: Job, token?: string): Promise<any>;
}
