import type Anthropic from "@anthropic-ai/sdk";
import type { DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";

export const ANTHROPIC_CLIENT = Symbol("ANTHROPIC_CLIENT");

export interface AnthropicModuleAsyncOptions {
  imports?: DynamicModule["imports"];
  // biome-ignore lint/suspicious/noExplicitAny: existing code
  inject?: any[];
  // biome-ignore lint/suspicious/noExplicitAny: existing code
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
