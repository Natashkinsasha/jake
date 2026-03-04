import { Module } from "@nestjs/common";
import { ClsModule } from "nestjs-cls";
import type { DeepgramClient } from "@deepgram/sdk";
import { DeepgramSttProvider } from "./deepgram-stt.provider";
import { ElevenLabsTtsProvider } from "./elevenlabs-tts.provider";
import { SharedConfigModule } from "../../../@shared/shared-config/shared-config.module";
import { SharedDeepgramModule } from "../../../@shared/shared-deepgram/shared-deepgram.module";
import { DEEPGRAM_CLIENT } from "../../../@lib/deepgram/src";
import { EnvService } from "../../../@shared/shared-config/env.service";
import { SttProvider, TtsProvider } from "../../../@lib/provider/src";

@Module({
  imports: [
    ClsModule.forFeatureAsync({
      imports: [SharedDeepgramModule],
      provide: SttProvider,
      inject: [DEEPGRAM_CLIENT],
      useFactory: (deepgram: DeepgramClient) => new DeepgramSttProvider(deepgram),
    }),
    ClsModule.forFeatureAsync({
      imports: [SharedConfigModule],
      provide: TtsProvider,
      inject: [EnvService],
      useFactory: (env: EnvService) => new ElevenLabsTtsProvider(env),
    }),
  ],
  exports: [ClsModule],
})
export class VoiceModule {}
