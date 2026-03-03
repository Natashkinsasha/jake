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

    return this.synthesizeWithRetry(text, voiceId, apiKey, 1);
  }

  private async synthesizeWithRetry(text: string, voiceId: string, apiKey: string, retries: number): Promise<string> {
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
      if (retries > 0 && response.status >= 500) {
        this.logger.warn(`ElevenLabs error ${response.status}, retrying (${retries} left)`);
        await new Promise((r) => setTimeout(r, 1000));
        return this.synthesizeWithRetry(text, voiceId, apiKey, retries - 1);
      }
      this.logger.error(`ElevenLabs error ${response.status}: ${body}`);
      throw new Error(`ElevenLabs TTS failed with status ${response.status}: ${body}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    this.logger.debug(`TTS audio: ${arrayBuffer.byteLength} bytes`);
    return Buffer.from(arrayBuffer).toString("base64");
  }
}
