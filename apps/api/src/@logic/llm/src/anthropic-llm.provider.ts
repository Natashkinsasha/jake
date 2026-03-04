import { Inject, Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import type { ZodSchema } from "zod";
import { ANTHROPIC_CLIENT } from "../../../@lib/anthropic/src";
import { LlmProvider } from "../../../@lib/provider/src";
import type { LlmMessage, LlmResponse, LlmStreamCallbacks } from "../../../@lib/provider/src";

@Injectable()
export class AnthropicLlmProvider extends LlmProvider {
  private readonly logger = new Logger(AnthropicLlmProvider.name);

  constructor(@Inject(ANTHROPIC_CLIENT) private client: Anthropic) {
    super();
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

  async generateStream(
    systemPrompt: string,
    messages: LlmMessage[],
    callbacks: LlmStreamCallbacks,
    options?: { maxTokens?: number; signal?: AbortSignal },
  ): Promise<LlmResponse> {
    const maxTokens = options?.maxTokens ?? 1024;
    this.logger.debug(`LLM stream request: model=claude-sonnet-4-20250514, maxTokens=${maxTokens}, messages=${messages.length}`);

    try {
      const stream = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        stream: true,
      });

      let fullText = "";
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of stream) {
        if (options?.signal?.aborted) {
          break;
        }

        if (event.type === "message_start") {
          inputTokens = event.message.usage.input_tokens;
          outputTokens = event.message.usage.output_tokens;
        } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;
          callbacks.onText(event.delta.text);
        } else if (event.type === "message_delta") {
          outputTokens = event.usage.output_tokens;
        }
      }

      const result: LlmResponse = {
        text: fullText,
        inputTokens,
        outputTokens,
      };

      this.logger.debug(`LLM stream done: inputTokens=${result.inputTokens}, outputTokens=${result.outputTokens}`);
      callbacks.onDone(result);

      return result;
    } catch (error) {
      if (options?.signal?.aborted) {
        this.logger.debug("LLM stream aborted");
        throw error;
      }
      this.logger.error(`LLM stream failed: ${error instanceof Error ? error.message : String(error)}`);
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
