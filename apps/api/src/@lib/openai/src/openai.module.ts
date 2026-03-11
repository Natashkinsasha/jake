import type { DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import type OpenAI from "openai";

export const OPENAI_CLIENT = Symbol("OPENAI_CLIENT");

export interface OpenaiModuleAsyncOptions {
  imports?: DynamicModule["imports"];
  // biome-ignore lint/suspicious/noExplicitAny: existing code
  inject?: any[];
  // biome-ignore lint/suspicious/noExplicitAny: existing code
  useFactory: (...args: any[]) => OpenAI | Promise<OpenAI>;
}

@Module({})
export class OpenaiModule {
  static forRootAsync(options: OpenaiModuleAsyncOptions): DynamicModule {
    return {
      module: OpenaiModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: OPENAI_CLIENT,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ],
      exports: [OPENAI_CLIENT],
    };
  }
}
