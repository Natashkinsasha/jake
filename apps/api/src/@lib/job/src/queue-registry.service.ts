import { Injectable } from "@nestjs/common";

@Injectable()
export class QueueRegistryService {
  private queues = new Map<string, unknown>();

  register(name: string, queue: unknown) {
    this.queues.set(name, queue);
  }

  get<T>(name: string): T | undefined {
    return this.queues.get(name) as T | undefined;
  }
}
