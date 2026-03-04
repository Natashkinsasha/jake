import { Module } from "@nestjs/common";
import { SttService } from "./stt.service";
import { TtsService } from "./tts.service";
import { SharedConfigModule } from "../../../@shared/shared-config/shared-config.module";

@Module({
  imports: [SharedConfigModule],
  providers: [SttService, TtsService],
  exports: [SttService, TtsService],
})
export class VoiceModule {}
