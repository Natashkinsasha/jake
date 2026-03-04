import { Module } from "@nestjs/common";
import { ClsModule } from "nestjs-cls";
import { DeepgramSttProvider } from "./deepgram-stt.provider";
import { ElevenLabsTtsProvider } from "./elevenlabs-tts.provider";
import { SharedConfigModule } from "../../../@shared/shared-config/shared-config.module";
import { SharedDeepgramModule } from "../../../@shared/shared-deepgram/shared-deepgram.module";
import { SttProvider, TtsProvider } from "../../../@lib/provider/src";

@Module({
  imports: [
    SharedConfigModule,
    SharedDeepgramModule,
    ClsModule.forFeatureAsync({
      provide: SttProvider,
      inject: [DeepgramSttProvider],
      useFactory: (deepgram: DeepgramSttProvider) => deepgram,
    }),
    ClsModule.forFeatureAsync({
      provide: TtsProvider,
      inject: [ElevenLabsTtsProvider],
      useFactory: (elevenlabs: ElevenLabsTtsProvider) => elevenlabs,
    }),
  ],
  providers: [DeepgramSttProvider, ElevenLabsTtsProvider],
  exports: [SttProvider, TtsProvider],
})
export class VoiceModule {}
