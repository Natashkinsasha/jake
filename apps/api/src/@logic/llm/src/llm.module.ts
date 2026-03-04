import { Module } from "@nestjs/common";
import { LlmService } from "./llm.service";
import { SharedConfigModule } from "../../../@shared/shared-config/shared-config.module";

@Module({
  imports: [SharedConfigModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
