import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import type { FastifyBasicAuthOptions } from '@fastify/basic-auth';
import basicAuth from '@fastify/basic-auth';
import type {
  DynamicModule,
  ModuleMetadata,
  NestModule,
  Type,
} from '@nestjs/common';
import { HttpStatus, Module, UnauthorizedException } from '@nestjs/common';
import { HttpAdapterHost, ModuleRef } from '@nestjs/core';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { QueueRegistryService } from '../../job/src';

export interface JobBoardModuleOptions {
  route: string;
  username: string;
  password: string;
  enabled?: boolean;
}

export interface JobBoardModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NestJS DI requires any[] for factory args
  useFactory?: (...args: any[]) => Promise<JobBoardModuleOptions> | JobBoardModuleOptions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NestJS DI injection tokens
  inject?: any[];
  useClass?: Type<JobBoardModuleOptionsFactory>;
  useExisting?: Type<JobBoardModuleOptionsFactory>;
}

export interface JobBoardModuleOptionsFactory {
  createJobBoardOptions():
    | Promise<JobBoardModuleOptions>
    | JobBoardModuleOptions;
}

const JOB_BOARD_OPTIONS = 'JOB_BOARD_OPTIONS';

@Module({})
export class JobBoardModule implements NestModule {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly adapterHost: HttpAdapterHost,
    private readonly queueRegistry: QueueRegistryService,
  ) {}

  static forRootAsync(options: JobBoardModuleAsyncOptions): DynamicModule {
    return {
      module: JobBoardModule,
      imports: options.imports,
      providers: [...this.createAsyncProviders(options)],
    };
  }

  private static createAsyncProviders(options: JobBoardModuleAsyncOptions) {
    const userFactory = options.useFactory;
    if (userFactory) {
      return [
        {
          provide: JOB_BOARD_OPTIONS,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NestJS DI pattern
          useFactory: async (...args: any[]) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- NestJS DI pattern passes any[] args
            const config = await userFactory(...args);
            return {
              enabled: true,
              ...config,
            };
          },
          inject: options.inject ?? [],
        },
      ];
    }

    if (options.useClass) {
      return [
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: JOB_BOARD_OPTIONS,
          useFactory: async (optionsFactory: JobBoardModuleOptionsFactory) => {
            const config = await optionsFactory.createJobBoardOptions();
            return {
              enabled: true,
              ...config,
            };
          },
          inject: [options.useClass],
        },
      ];
    }

    if (options.useExisting) {
      return [
        {
          provide: JOB_BOARD_OPTIONS,
          useFactory: async (optionsFactory: JobBoardModuleOptionsFactory) => {
            const config = await optionsFactory.createJobBoardOptions();
            return {
              enabled: true,
              ...config,
            };
          },
          inject: [options.useExisting],
        },
      ];
    }

    return [];
  }

  configure() {
    const options = this.moduleRef.get<JobBoardModuleOptions>(
      JOB_BOARD_OPTIONS,
      {
        strict: false,
      },
    );

    if (!options.enabled) {
      return;
    }

    const route = options.route;
    const username = options.username;
    const password = options.password;

    const serverAdapter = new FastifyAdapter();
    serverAdapter.setBasePath(route);

    const queues = this.queueRegistry.getAll();
    createBullBoard({
      queues: queues.map((queue) => new BullMQAdapter(queue)),
      serverAdapter,
    });

    const app = this.adapterHost.httpAdapter.getInstance<FastifyInstance>();

    const authenticate: FastifyBasicAuthOptions['authenticate'] = true;

    const validate: FastifyBasicAuthOptions['validate'] = (
      user: string,
      pass: string,
    ) => {
      if (user !== username || pass !== password) {
        throw new UnauthorizedException();
      }
    };

    void app.register(basicAuth, {
      validate,
      authenticate,
    });

    const bullboardPlugin = serverAdapter.registerPlugin();

    void app.register((instance: FastifyInstance, _opts: Record<string, unknown>, done: (err?: Error) => void) => {
      instance.addHook('onRequest', (req: FastifyRequest, reply: FastifyReply, next: (err?: Error) => void) => {
        (instance as FastifyInstance & { basicAuth: (req: FastifyRequest, reply: FastifyReply, cb: (err?: Error) => void) => void }).basicAuth(req, reply, function (error?: Error) {
          if (!error) {
            next(); return;
          }

          const statusCode =
            (error as Error & { statusCode?: number }).statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
          void reply.code(statusCode).send({ error: error.name });
        });
      });

      void instance.register(bullboardPlugin, {
        prefix: route,
      });

      done();
    });
  }
}
