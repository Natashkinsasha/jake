import { Module } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicLlmProvider } from "./anthropic-llm.provider";
import { SharedAnthropicModule } from "../../../@shared/shared-anthropic/shared-anthropic.module";
import { ANTHROPIC_CLIENT } from "../../../@lib/anthropic/src";
import { LlmProvider } from "../../../@lib/provider/src";

@Module({
  imports: [SharedAnthropicModule],
  providers: [
    {
      provide: LlmProvider,
      inject: [ANTHROPIC_CLIENT],
      useFactory: (client: Anthropic) => new AnthropicLlmProvider(client),
    },
  ],
  exports: [LlmProvider],
})
export class LlmModule {}
