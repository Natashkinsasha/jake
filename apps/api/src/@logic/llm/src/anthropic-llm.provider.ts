import { Inject, Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import type { ZodSchema } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ANTHROPIC_CLIENT } from "@lib/anthropic/src";
import { LlmProvider } from "@lib/provider/src";
import type { LlmMessage, LlmResponse, LlmStreamCallbacks } from "@lib/provider/src";
import { withSpan } from "./llm-tracing";

@Injectable()
export class AnthropicLlmProvider extends LlmProvider {
  private readonly logger = new Logger(AnthropicLlmProvider.name);
  private readonly MODEL = "claude-sonnet-4-20250514";

  constructor(@Inject(ANTHROPIC_CLIENT) private client: Anthropic) {
    super();
  }

  async generate(
    systemPrompt: string,
    messages: LlmMessage[],
    maxTokens = 1024,
    spanName?: string,
  ): Promise<LlmResponse> {
    const doGenerate = async (): Promise<LlmResponse> => {
      this.logger.debug(`LLM request: model=${this.MODEL}, maxTokens=${maxTokens}, messages=${messages.length}`);

      try {
        const response = await this.client.messages.create({
          model: this.MODEL,
          max_tokens: maxTokens,
          system: [{ type: "text" as const, text: systemPrompt, cache_control: { type: "ephemeral" as const } }],
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
    };

    if (!spanName) return doGenerate();

    return withSpan(
      spanName,
      { provider: "anthropic", model: this.MODEL, method: "generate" },
      doGenerate,
      (res) => ({ input_tokens: res.inputTokens, output_tokens: res.outputTokens }),
    );
  }

  async generateStream(
    systemPrompt: string,
    messages: LlmMessage[],
    callbacks: LlmStreamCallbacks,
    options?: { maxTokens?: number; signal?: AbortSignal; spanName?: string },
  ): Promise<LlmResponse> {
    const doStream = async (): Promise<LlmResponse> => {
      const maxTokens = options?.maxTokens ?? 1024;
      this.logger.debug(`LLM stream request: model=${this.MODEL}, maxTokens=${maxTokens}, messages=${messages.length}`);

      try {
        const stream = await this.client.messages.create({
          model: this.MODEL,
          max_tokens: maxTokens,
          system: [{ type: "text" as const, text: systemPrompt, cache_control: { type: "ephemeral" as const } }],
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
    };

    if (!options?.spanName) return doStream();

    return withSpan(
      options.spanName,
      { provider: "anthropic", model: this.MODEL, method: "generateStream" },
      doStream,
      (res) => ({ input_tokens: res.inputTokens, output_tokens: res.outputTokens }),
    );
  }

  async generateJson<T>(
    systemPrompt: string,
    messages: LlmMessage[],
    schema: ZodSchema<T>,
    maxTokens = 2048,
    spanName?: string,
  ): Promise<T> {
    const doGenerateJson = async (): Promise<T> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const jsonSchema = zodToJsonSchema(schema as any, { target: "openApi3" });
      this.logger.debug(`LLM tool_use request: model=${this.MODEL}, maxTokens=${maxTokens}`);

      try {
        const response = await this.client.messages.create({
          model: this.MODEL,
          max_tokens: maxTokens,
          system: [{ type: "text" as const, text: systemPrompt, cache_control: { type: "ephemeral" as const } }],
          messages,
          tools: [
            {
              name: "output",
              description: "Return the structured result",
              input_schema: jsonSchema as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: "tool", name: "output" },
        });

        const toolBlock = response.content.find(
          (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
        );
        if (!toolBlock) {
          throw new Error("No tool_use block in LLM response");
        }

        this.logger.debug(`LLM tool_use response: inputTokens=${response.usage.input_tokens}, outputTokens=${response.usage.output_tokens}`);

        // LLMs sometimes return stringified JSON instead of an object
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let raw: any = toolBlock.input;
        if (typeof raw === "string") {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            raw = JSON.parse(raw);
          } catch {
            throw new Error("LLM returned a non-JSON string instead of an object");
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        let sanitized = this.sanitizeNullStrings(raw);
        let result = schema.safeParse(sanitized);

        // LLMs sometimes return a bare value instead of a single-element array
        if (!result.success) {
          const arrayIssues = result.error.issues.filter(
            (i) => i.code === "invalid_type" && i.expected === "array",
          );
          if (arrayIssues.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            sanitized = this.coerceToArrays(sanitized, arrayIssues.map((i) => i.path));
            result = schema.safeParse(sanitized);
          }
        }

        if (!result.success) {
          this.logger.error(
            `LLM tool_use validation failed: ${JSON.stringify(result.error.issues)}`,
          );
          throw new Error(`LLM response validation failed: ${result.error.issues.map((i) => i.message).join(", ")}`);
        }

        return result.data;
      } catch (error) {
        this.logger.error(`LLM tool_use failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    };

    if (!spanName) return doGenerateJson();

    return withSpan(
      spanName,
      { provider: "anthropic", model: this.MODEL, method: "generateJson" },
      doGenerateJson,
    );
  }

  // Wrap bare values in arrays at the specified paths
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private coerceToArrays(obj: any, paths: (string | number)[][]): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const copy = JSON.parse(JSON.stringify(obj));
    for (const path of paths) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      let target: any = copy;
      for (let i = 0; i < path.length - 1; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        target = target?.[path[i]!]; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      }
      const key = path[path.length - 1]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (target != null && !Array.isArray(target[key])) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        target[key] = target[key] == null ? [] : [target[key]];
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return copy;
  }

  // LLMs sometimes return "null" string instead of JSON null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sanitizeNullStrings(obj: any): any {
    if (obj === "null") return null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (Array.isArray(obj)) return obj.map((v: unknown) => this.sanitizeNullStrings(v));
    if (obj !== null && typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        result[k] = this.sanitizeNullStrings(v);
      }
      return result;
    }
    return obj;
  }
}
