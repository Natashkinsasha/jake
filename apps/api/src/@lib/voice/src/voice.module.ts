import { Module } from "@nestjs/common";
import { SttService } from "./stt.service";
import { TtsService } from "./tts.service";

@Module({
  providers: [SttService, TtsService],
  exports: [SttService, TtsService],
})
export class VoiceModule {}
