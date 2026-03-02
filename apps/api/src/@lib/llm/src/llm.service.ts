import { Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { EnvService } from "../../../@shared/shared-config/env.service";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

@Injectable()
export class LlmService {
  private client: Anthropic;

  constructor(private env: EnvService) {
    this.client = new Anthropic({ apiKey: env.get("ANTHROPIC_API_KEY") });
  }

  async generate(
    systemPrompt: string,
    messages: LlmMessage[],
    maxTokens = 1024,
  ): Promise<LlmResponse> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }

  async generateJson<T>(
    systemPrompt: string,
    messages: LlmMessage[],
    maxTokens = 2048,
  ): Promise<T> {
    const response = await this.generate(systemPrompt, messages, maxTokens);
    const cleaned = response.text.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(cleaned) as T;
  }
}
