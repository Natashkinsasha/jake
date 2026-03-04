import type { DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import type { DeepgramClient } from "@deepgram/sdk";

export const DEEPGRAM_CLIENT = Symbol("DEEPGRAM_CLIENT");

export interface DeepgramModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => DeepgramClient | Promise<DeepgramClient>;
}

@Module({})
export class DeepgramModule {
  static forRootAsync(options: DeepgramModuleAsyncOptions): DynamicModule {
    return {
      module: DeepgramModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: DEEPGRAM_CLIENT,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ],
      exports: [DEEPGRAM_CLIENT],
    };
  }
}
