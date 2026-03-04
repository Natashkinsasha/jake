import { Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { ZodSchema } from "zod";
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
  private readonly logger = new Logger(LlmService.name);
  private client: Anthropic;

  constructor(private env: EnvService) {
    this.client = new Anthropic({ apiKey: env.get("ANTHROPIC_API_KEY"), maxRetries: 2 });
  }

  async generate(
    systemPrompt: string,
    messages: LlmMessage[],
    maxTokens = 1024,
  ): Promise<LlmResponse> {
    this.logger.debug(`LLM request: model=claude-sonnet-4-20250514, maxTokens=${maxTokens}, messages=${messages.length}`);

    try {
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

      this.logger.debug(`LLM response: inputTokens=${response.usage.input_tokens}, outputTokens=${response.usage.output_tokens}`);

      return {
        text,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (error) {
      this.logger.error(`LLM request failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async generateJson<T>(
    systemPrompt: string,
    messages: LlmMessage[],
    maxTokens?: number,
    schema?: ZodSchema<T>,
  ): Promise<T> {
    const response = await this.generate(systemPrompt, messages, maxTokens ?? 2048);
    const cleaned = response.text.replace(/```json\n?|```/g, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (error) {
      this.logger.error(`Failed to parse LLM JSON response: ${cleaned.substring(0, 200)}`);
      throw error;
    }

    if (!schema) {
      return parsed as T;
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      this.logger.error(
        `LLM JSON validation failed: ${JSON.stringify(result.error.issues)}. Raw: ${cleaned.substring(0, 200)}`,
      );
      throw new Error(`LLM response validation failed: ${result.error.issues.map((i) => i.message).join(", ")}`);
    }

    return result.data;
  }
}
