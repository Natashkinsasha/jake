import type { DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";

export const ANTHROPIC_CLIENT = Symbol("ANTHROPIC_CLIENT");

export interface AnthropicModuleAsyncOptions {
  imports?: DynamicModule["imports"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => Anthropic | Promise<Anthropic>;
}

@Module({})
export class AnthropicModule {
  static forRootAsync(options: AnthropicModuleAsyncOptions): DynamicModule {
    return {
      module: AnthropicModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: ANTHROPIC_CLIENT,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ],
      exports: [ANTHROPIC_CLIENT],
    };
  }
}
