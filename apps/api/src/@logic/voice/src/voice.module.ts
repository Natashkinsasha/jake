import { Module } from "@nestjs/common";
import { SttService } from "./stt.service";
import { TtsService } from "./tts.service";
import { SharedConfigModule } from "../../../@shared/shared-config/shared-config.module";
import { SharedDeepgramModule } from "../../../@shared/shared-deepgram/shared-deepgram.module";

@Module({
  imports: [SharedConfigModule, SharedDeepgramModule],
  providers: [SttService, TtsService],
  exports: [SttService, TtsService],
})
export class VoiceModule {}
