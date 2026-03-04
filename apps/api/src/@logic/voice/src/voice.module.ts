import { Module } from "@nestjs/common";
import { DeepgramSttProvider } from "./deepgram-stt.provider";
import { ElevenLabsTtsProvider } from "./elevenlabs-tts.provider";
import { SharedConfigModule } from "../../../@shared/shared-config/shared-config.module";
import { SharedDeepgramModule } from "../../../@shared/shared-deepgram/shared-deepgram.module";

@Module({
  imports: [SharedConfigModule, SharedDeepgramModule],
  providers: [DeepgramSttProvider, ElevenLabsTtsProvider],
  exports: [DeepgramSttProvider, ElevenLabsTtsProvider],
})
export class VoiceModule {}
