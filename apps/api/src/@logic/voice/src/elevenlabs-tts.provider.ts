import { Injectable, Logger } from "@nestjs/common";
import { withSpan } from "../../llm/src/llm-tracing";
import { EnvService } from "../../../@shared/shared-config/env.service";

import { TtsProvider } from "../../../@lib/provider/src";

@Injectable()
export class ElevenLabsTtsProvider extends TtsProvider {
  private readonly logger = new Logger(ElevenLabsTtsProvider.name);

  constructor(private env: EnvService) {
    super();
  }

  async synthesize(text: string, voiceId: string, speed?: number): Promise<string> {
    const apiKey = this.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      this.logger.warn("ELEVENLABS_API_KEY not set, skipping TTS");
      return "";
    }

    this.logger.log(`Synthesizing ${text.length} chars for voice ${voiceId} (speed=${speed ?? 1.0})`);

    return withSpan(
      "tts.synthesize",
      { provider: "elevenlabs", model: "eleven_turbo_v2_5", voice_id: voiceId, input_length: text.length, speed: speed ?? 1.0 },
      () => this.synthesizeWithRetry(text, voiceId, apiKey, 1, speed),
      (result) => ({ output_bytes: Buffer.byteLength(result, "base64") }),
    );
  }

  private async synthesizeWithRetry(text: string, voiceId: string, apiKey: string, retries: number, speed?: number): Promise<string> {
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
          ...(speed != null && speed !== 1.0 ? { speed } : {}),
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      if (retries > 0 && response.status >= 500) {
        this.logger.warn(`ElevenLabs error ${response.status}, retrying (${retries} left)`);
        await new Promise((r) => setTimeout(r, 1000));
        return this.synthesizeWithRetry(text, voiceId, apiKey, retries - 1, speed);
      }
      this.logger.error(`ElevenLabs error ${response.status}: ${body}`);
      throw new Error(`ElevenLabs TTS failed with status ${response.status}: ${body}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    this.logger.debug(`TTS audio: ${arrayBuffer.byteLength} bytes`);
    return Buffer.from(arrayBuffer).toString("base64");
  }
}
