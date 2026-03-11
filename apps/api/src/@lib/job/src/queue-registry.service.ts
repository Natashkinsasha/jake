import { Injectable } from "@nestjs/common";
import type { Queue } from "bullmq";

@Injectable()
export class QueueRegistryService {
  private readonly queues = new Set<Queue>();

  add(queue: Queue) {
    this.queues.add(queue);
  }

  getAll(): Queue[] {
    return [...this.queues];
  }
}
