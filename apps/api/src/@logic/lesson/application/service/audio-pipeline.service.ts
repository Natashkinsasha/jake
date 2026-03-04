import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { SttService } from "../../../voice/src/stt.service";
import { TtsService } from "../../../voice/src/tts.service";
import { LessonResponseService } from "./lesson-response.service";
import { LlmMessage } from "../../../llm/src/llm.service";

@Injectable()
export class AudioPipelineService {
  private readonly logger = new Logger(AudioPipelineService.name);

  constructor(
    private stt: SttService,
    private tts: TtsService,
    private lessonResponse: LessonResponseService,
  ) {}

  async processAudio(
    audioBase64: string,
    systemPrompt: string,
    history: LlmMessage[],
    voiceId: string,
    speechSpeed?: number,
  ) {
    // 1. STT
    const transcript = audioBase64
      ? await this.stt.transcribe(audioBase64)
      : history[history.length - 1]?.content ?? "";

    if (!transcript) {
      throw new BadRequestException("Could not understand the audio");
    }

    // 2. Add to history
    const updatedHistory: LlmMessage[] = [
      ...history,
      ...(audioBase64 ? [{ role: "user" as const, content: transcript }] : []),
    ];

    // 3. LLM
    const response = await this.lessonResponse.generate(systemPrompt, updatedHistory);

    // 4. TTS
    const audio = await this.tts.synthesize(response.text, voiceId, speechSpeed);

    return {
      transcript,
      tutorText: response.text,
      tutorAudio: audio,
      exercise: response.exercise,
    };
  }
}
