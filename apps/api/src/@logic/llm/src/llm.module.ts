import { Module } from "@nestjs/common";
import { AnthropicLlmProvider } from "./anthropic-llm.provider";
import { SharedAnthropicModule } from "../../../@shared/shared-anthropic/shared-anthropic.module";

@Module({
  imports: [SharedAnthropicModule],
  providers: [AnthropicLlmProvider],
  exports: [AnthropicLlmProvider],
})
export class LlmModule {}
