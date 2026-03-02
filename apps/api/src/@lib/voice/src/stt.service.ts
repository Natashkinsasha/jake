import { Injectable } from "@nestjs/common";
import { createClient } from "@deepgram/sdk";
import { EnvService } from "../../../@shared/shared-config/env.service";

@Injectable()
export class SttService {
  private deepgram;

  constructor(private env: EnvService) {
    this.deepgram = createClient(env.get("DEEPGRAM_API_KEY"));
  }

  async transcribe(audioBase64: string): Promise<string> {
    const audioBuffer = Buffer.from(audioBase64, "base64");

    const { result } = await this.deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      { model: "nova-2", language: "en", smart_format: true, punctuate: true, mimetype: "audio/webm" },
    );

    return result?.results?.channels[0]?.alternatives[0]?.transcript || "";
  }
}
