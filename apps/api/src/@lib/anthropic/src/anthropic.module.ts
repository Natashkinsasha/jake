import type Anthropic from "@anthropic-ai/sdk";
import type { DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";

export const ANTHROPIC_CLIENT = Symbol("ANTHROPIC_CLIENT");

export interface AnthropicModuleAsyncOptions {
  imports?: DynamicModule["imports"];
  inject?: any[];
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
