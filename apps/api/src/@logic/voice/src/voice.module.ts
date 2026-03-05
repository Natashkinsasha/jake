import { Module } from "@nestjs/common";
import { ElevenLabsTtsProvider } from "./elevenlabs-tts.provider";
import { SharedConfigModule } from "../../../@shared/shared-config/shared-config.module";
import { EnvService } from "../../../@shared/shared-config/env.service";
import { TtsProvider } from "../../../@lib/provider/src";

@Module({
  imports: [SharedConfigModule],
  providers: [
    {
      provide: TtsProvider,
      inject: [EnvService],
      useFactory: (env: EnvService) => new ElevenLabsTtsProvider(env),
    },
  ],
  exports: [TtsProvider],
})
export class VoiceModule {}
