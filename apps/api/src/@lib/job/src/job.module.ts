import {
  BullModule,
  getQueueToken,
  RegisterQueueOptions,
  SharedBullAsyncConfiguration,
} from '@nestjs/bullmq';
import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QueueRegistryService } from './queue-registry.service';

@Module({})
export class JobModule {
  private static queueRegistryService = new QueueRegistryService();
  public static forRootAsync(
    asyncBullConfig: SharedBullAsyncConfiguration,
  ): DynamicModule {
    return {
      module: JobModule,
      imports: [BullModule.forRootAsync(asyncBullConfig)],
      providers: [
        {
          useValue: JobModule.queueRegistryService,
          provide: QueueRegistryService,
        },
      ],
      exports: [BullModule, QueueRegistryService],
    };
  }

  static registerQueue(
    options: RegisterQueueOptions & { name: string },
  ): DynamicModule {
    return {
      module: JobModule,
      imports: [BullModule.registerQueue(options)],
      providers: [
        {
          useValue: JobModule.queueRegistryService,
          provide: QueueRegistryService,
        },
        {
          provide: Symbol(`JOB_QUEUE_REGISTER__${options.name}`),
          useFactory: (registry: QueueRegistryService, queue: Queue) => {
            registry.add(queue);
            return true;
          },
          inject: [QueueRegistryService, getQueueToken(options.name)],
        },
      ],
      exports: [BullModule, QueueRegistryService],
    };
  }
}
