import { Inject, Injectable, Logger } from "@nestjs/common";
import { withSpan } from "../../llm/src/llm-tracing";
import type { DeepgramClient } from "@deepgram/sdk";
import { DEEPGRAM_CLIENT } from "../../../@lib/deepgram/src";

import { SttProvider } from "../../../@lib/provider/src";

@Injectable()
export class DeepgramSttProvider extends SttProvider {
  private readonly logger = new Logger(DeepgramSttProvider.name);

  constructor(@Inject(DEEPGRAM_CLIENT) private deepgram: DeepgramClient) {
    super();
  }

  async transcribe(audioBase64: string): Promise<string> {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    this.logger.debug(`STT request: audioSize=${audioBuffer.byteLength} bytes`);

    return withSpan(
      "deepgram.stt",
      { "stt.provider": "deepgram", "stt.model": "nova-3", "stt.input_bytes": audioBuffer.byteLength },
      () => this.transcribeWithRetry(audioBuffer, 1),
      (transcript) => ({ "stt.output_length": transcript.length }),
    );
  }

  private async transcribeWithRetry(audioBuffer: Buffer, retries: number): Promise<string> {
    try {
      const { result } = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        { model: "nova-3", language: "en", smart_format: true, punctuate: true, mimetype: "audio/webm" },
      );

      const transcript = result?.results.channels[0]?.alternatives[0]?.transcript ?? "";
      this.logger.debug(`STT result: transcript="${transcript.substring(0, 100)}${transcript.length > 100 ? "..." : ""}"`);
      return transcript;
    } catch (error) {
      if (retries > 0) {
        this.logger.warn(`Deepgram STT failed, retrying (${retries} left): ${error instanceof Error ? error.message : String(error)}`);
        await new Promise((r) => setTimeout(r, 1000));
        return this.transcribeWithRetry(audioBuffer, retries - 1);
      }
      this.logger.error(`Deepgram STT failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
