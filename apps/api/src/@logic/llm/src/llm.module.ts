import { Module } from "@nestjs/common";
import { LlmService } from "./llm.service";
import { SharedAnthropicModule } from "../../../@shared/shared-anthropic/shared-anthropic.module";

@Module({
  imports: [SharedAnthropicModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
