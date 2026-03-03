import { Injectable, Logger } from "@nestjs/common";
import { createClient } from "@deepgram/sdk";
import { EnvService } from "../../../@shared/shared-config/env.service";

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);
  private deepgram;

  constructor(private env: EnvService) {
    this.deepgram = createClient(env.get("DEEPGRAM_API_KEY"));
  }

  async transcribe(audioBase64: string): Promise<string> {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    this.logger.debug(`STT request: audioSize=${audioBuffer.byteLength} bytes`);

    return this.transcribeWithRetry(audioBuffer, 1);
  }

  private async transcribeWithRetry(audioBuffer: Buffer, retries: number): Promise<string> {
    try {
      const { result } = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        { model: "nova-3", language: "en", smart_format: true, punctuate: true, mimetype: "audio/webm" },
      );

      const transcript = result?.results?.channels[0]?.alternatives[0]?.transcript || "";
      this.logger.debug(`STT result: transcript="${transcript.substring(0, 100)}${transcript.length > 100 ? "..." : ""}"`);
      return transcript;
    } catch (error) {
      if (retries > 0) {
        this.logger.warn(`Deepgram STT failed, retrying (${retries} left): ${error instanceof Error ? error.message : error}`);
        await new Promise((r) => setTimeout(r, 1000));
        return this.transcribeWithRetry(audioBuffer, retries - 1);
      }
      this.logger.error(`Deepgram STT failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }
}
