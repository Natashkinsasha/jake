import { Injectable } from "@nestjs/common";
import { EnvService } from "../../../@shared/shared-config/env.service";

@Injectable()
export class TtsService {
  constructor(private env: EnvService) {}

  async synthesize(text: string, voiceId: string): Promise<string> {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.env.get("ELEVENLABS_API_KEY"),
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
        }),
      },
    );

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("base64");
  }
}
