import { Injectable, Logger } from "@nestjs/common";
import { EnvService } from "../../../@shared/shared-config/env.service";

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  constructor(private env: EnvService) {}

  async synthesize(text: string, voiceId: string): Promise<string> {
    const apiKey = this.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      this.logger.warn("ELEVENLABS_API_KEY not set, skipping TTS");
      return "";
    }

    this.logger.log(`Synthesizing ${text.length} chars for voice ${voiceId}`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_22050_32`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`ElevenLabs error ${response.status}: ${body}`);
      return "";
    }

    const arrayBuffer = await response.arrayBuffer();
    this.logger.debug(`TTS audio: ${arrayBuffer.byteLength} bytes`);
    return Buffer.from(arrayBuffer).toString("base64");
  }
}
