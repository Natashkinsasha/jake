import type Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_CLIENT } from "@lib/anthropic/src";
import { LlmProvider } from "@lib/provider/src";
import { Module } from "@nestjs/common";
import { SharedAnthropicModule } from "@shared/shared-anthropic/shared-anthropic.module";
import { AnthropicLlmProvider } from "./anthropic-llm.provider";
import { ModerationService } from "./moderation/moderation.service";

@Module({
  imports: [SharedAnthropicModule],
  providers: [
    {
      provide: LlmProvider,
      inject: [ANTHROPIC_CLIENT],
      useFactory: (client: Anthropic) => new AnthropicLlmProvider(client),
    },
    ModerationService,
  ],
  exports: [LlmProvider, ModerationService],
})
export class LlmModule {}
