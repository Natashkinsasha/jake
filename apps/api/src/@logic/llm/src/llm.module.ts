import { Module } from "@nestjs/common";
import { ClsModule } from "nestjs-cls";
import { AnthropicLlmProvider } from "./anthropic-llm.provider";
import { SharedAnthropicModule } from "../../../@shared/shared-anthropic/shared-anthropic.module";
import { LlmProvider } from "../../../@lib/provider/src";

@Module({
  imports: [
    SharedAnthropicModule,
    ClsModule.forFeatureAsync({
      provide: LlmProvider,
      inject: [AnthropicLlmProvider],
      useFactory: (anthropic: AnthropicLlmProvider) => anthropic,
    }),
  ],
  providers: [AnthropicLlmProvider],
  exports: [LlmProvider],
})
export class LlmModule {}
