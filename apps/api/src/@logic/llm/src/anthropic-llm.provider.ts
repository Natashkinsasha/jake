import type Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_CLIENT } from "@lib/anthropic/src";
import type { LlmMessage, LlmRequestOptions, LlmResponse, LlmStreamCallbacks, LlmTier } from "@lib/provider/src";
import { LlmProvider, LlmRefusalError } from "@lib/provider/src";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ZodSchema } from "zod";
import { withSpan } from "./llm-tracing";
import { toStructuredOutputSchema } from "./structured-output-schema";

type Effort = "low" | "medium" | "high";
type ThinkingConfig = { type: "between_tools" } | { type: "disabled" };

interface ModelProfile {
  model: string;
  thinking: ThinkingConfig;
  effort: Effort;
}

// Voice replies need a short time to first token: no extended thinking, low effort.
// between_tools is the lowest thinking setting on Sonnet 5.5 (it rejects "disabled");
// Haiku 5.5 accepts "disabled" at effort high or below.
const MODEL_PROFILES: Record<LlmTier, ModelProfile> = {
  main: { model: "claude-sonnet-5-5", thinking: { type: "between_tools" }, effort: "low" },
  fast: { model: "claude-haiku-5-5", thinking: { type: "disabled" }, effort: "low" },
};

// Request fields newer than the pinned SDK types (@anthropic-ai/sdk 0.39):
// thinking.between_tools, output_config and mid-conversation system messages.
export interface AnthropicMessageParam {
  role: LlmMessage["role"];
  content: string | Anthropic.TextBlockParam[];
}

interface MessageRequest {
  model: string;
  max_tokens: number;
  thinking: ThinkingConfig;
  output_config: { effort: Effort; format?: { type: "json_schema"; schema: Record<string, unknown> } };
  system: Anthropic.TextBlockParam[];
  messages: AnthropicMessageParam[];
}

const EPHEMERAL = { type: "ephemeral" } as const;

// Drops what the API would reject (empty turns, system notes out of place) and, for multi-turn
// chats, marks the last user message as a cache breakpoint. The breakpoint stays on the user
// message, not on a trailing system note, so the cached prefix is always part of stored history.
export function toAnthropicMessages(messages: LlmMessage[], cacheConversation: boolean): AnthropicMessageParam[] {
  const nonEmpty = messages.filter((m) => m.content.trim() !== "");
  const result: AnthropicMessageParam[] = nonEmpty
    .filter(
      (m, i) =>
        m.role !== "system" ||
        (nonEmpty[i - 1]?.role === "user" && (i === nonEmpty.length - 1 || nonEmpty[i + 1]?.role === "assistant")),
    )
    .map((m) => ({ role: m.role, content: m.content }));

  if (cacheConversation) {
    for (let i = result.length - 1; i >= 0; i--) {
      const message = result[i];
      if (message?.role === "user" && typeof message.content === "string") {
        result[i] = { role: "user", content: [{ type: "text", text: message.content, cache_control: EPHEMERAL }] };
        break;
      }
    }
  }
  return result;
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function toResponse(
  text: string,
  usage: Anthropic.Usage | null,
  outputTokens: number,
  stopReason: string | null,
): LlmResponse {
  return {
    text,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens,
    cacheReadInputTokens: usage?.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: usage?.cache_creation_input_tokens ?? 0,
    refused: stopReason === "refusal",
  };
}

function formatUsage(r: LlmResponse): string {
  return `input=${r.inputTokens}, cacheRead=${r.cacheReadInputTokens}, cacheWrite=${r.cacheCreationInputTokens}, output=${r.outputTokens}`;
}

@Injectable()
export class AnthropicLlmProvider extends LlmProvider {
  private readonly logger = new Logger(AnthropicLlmProvider.name);

  constructor(@Inject(ANTHROPIC_CLIENT) private client: Anthropic) {
    super();
  }

  async generate(systemPrompt: string, messages: LlmMessage[], options?: LlmRequestOptions): Promise<LlmResponse> {
    const profile = MODEL_PROFILES[options?.tier ?? "main"];
    const request = this.buildRequest(profile, systemPrompt, messages, options?.maxTokens ?? 1024, options);

    return this.call(options?.spanName, "generate", request, async () => {
      const response = await this.client.messages.create(
        request as unknown as Anthropic.MessageCreateParamsNonStreaming,
      );
      const result = toResponse(
        textOf(response.content),
        response.usage,
        response.usage.output_tokens,
        response.stop_reason,
      );
      return { response: result, value: result };
    });
  }

  async generateStream(
    systemPrompt: string,
    messages: LlmMessage[],
    callbacks: LlmStreamCallbacks,
    options?: LlmRequestOptions & { signal?: AbortSignal },
  ): Promise<LlmResponse> {
    const profile = MODEL_PROFILES[options?.tier ?? "main"];
    const request = this.buildRequest(profile, systemPrompt, messages, options?.maxTokens ?? 1024, options);
    const signal = options?.signal;

    return this.call(
      options?.spanName,
      "generateStream",
      request,
      async () => {
        const stream = await this.client.messages.create(
          { ...request, stream: true } as unknown as Anthropic.MessageCreateParamsStreaming,
          { signal },
        );

        let text = "";
        let usage: Anthropic.Usage | null = null;
        let outputTokens = 0;
        let stopReason: string | null = null;

        for await (const event of stream) {
          if (signal?.aborted) {
            break;
          }

          if (event.type === "message_start") {
            usage = event.message.usage;
          } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            text += event.delta.text;
            callbacks.onText(event.delta.text);
          } else if (event.type === "message_delta") {
            stopReason = event.delta.stop_reason;
            outputTokens = event.usage.output_tokens;
          }
        }

        const result = toResponse(text, usage, outputTokens, stopReason);
        callbacks.onDone(result);
        return { response: result, value: result };
      },
      signal,
    );
  }

  async generateJson<T>(
    systemPrompt: string,
    messages: LlmMessage[],
    schema: ZodSchema<T>,
    options?: LlmRequestOptions,
  ): Promise<T> {
    const profile = MODEL_PROFILES[options?.tier ?? "main"];
    const request = this.buildRequest(profile, systemPrompt, messages, options?.maxTokens ?? 4096, options);
    request.output_config.format = { type: "json_schema", schema: toStructuredOutputSchema(schema) };

    return this.call(options?.spanName, "generateJson", request, async () => {
      const response = await this.client.messages.create(
        request as unknown as Anthropic.MessageCreateParamsNonStreaming,
      );
      const stopReason: string | null = response.stop_reason;
      const result = toResponse(textOf(response.content), response.usage, response.usage.output_tokens, stopReason);

      if (result.refused) {
        throw new LlmRefusalError("LLM refused to return structured output");
      }
      if (stopReason === "max_tokens") {
        throw new Error(`LLM structured output was cut off at max_tokens=${request.max_tokens}`);
      }
      return { response: result, value: this.parseJson(result.text, schema) };
    });
  }

  private buildRequest(
    profile: ModelProfile,
    systemPrompt: string,
    messages: LlmMessage[],
    maxTokens: number,
    options: LlmRequestOptions | undefined,
  ): MessageRequest {
    return {
      model: profile.model,
      max_tokens: maxTokens,
      thinking: profile.thinking,
      output_config: { effort: profile.effort },
      system: [{ type: "text", text: systemPrompt, cache_control: EPHEMERAL }],
      messages: toAnthropicMessages(messages, options?.cacheConversation ?? false),
    };
  }

  // Logs, traces (with cache usage) and error-reports one API call.
  private async call<T>(
    spanName: string | undefined,
    method: string,
    request: MessageRequest,
    fn: () => Promise<{ response: LlmResponse; value: T }>,
    signal?: AbortSignal,
  ): Promise<T> {
    const run = async () => {
      this.logger.debug(
        `LLM ${method} request: model=${request.model}, maxTokens=${request.max_tokens}, messages=${request.messages.length}`,
      );
      try {
        const outcome = await fn();
        this.logger.debug(`LLM ${method} done: ${formatUsage(outcome.response)}`);
        if (outcome.response.refused) {
          this.logger.warn(`LLM ${method} refused: model=${request.model}`);
        }
        return outcome;
      } catch (error) {
        if (signal?.aborted) {
          this.logger.debug(`LLM ${method} aborted`);
        } else {
          this.logger.error(`LLM ${method} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        throw error;
      }
    };

    if (!spanName) {
      return (await run()).value;
    }

    const outcome = await withSpan(
      spanName,
      { provider: "anthropic", model: request.model, method },
      run,
      ({ response }) => ({
        input_tokens: response.inputTokens,
        cache_read_input_tokens: response.cacheReadInputTokens,
        cache_creation_input_tokens: response.cacheCreationInputTokens,
        output_tokens: response.outputTokens,
        refused: response.refused,
      }),
    );
    return outcome.value;
  }

  private parseJson<T>(text: string, schema: ZodSchema<T>): T {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (parseError) {
      // biome-ignore lint/nursery/useErrorCause: ES2021 target
      throw new Error(`LLM returned invalid JSON: ${parseError}`);
    }

    const result = schema.safeParse(this.sanitizeNullStrings(raw));
    if (!result.success) {
      this.logger.error(`LLM structured output validation failed: ${JSON.stringify(result.error.issues)}`);
      throw new Error(`LLM response validation failed: ${result.error.issues.map((i) => i.message).join(", ")}`);
    }
    return result.data;
  }

  // LLMs sometimes return "null" string instead of JSON null
  // biome-ignore lint/suspicious/noExplicitAny: existing code
  private sanitizeNullStrings(obj: any): any {
    if (obj === "null") {
      return null;
    }
    if (Array.isArray(obj)) {
      return obj.map((v: unknown) => this.sanitizeNullStrings(v));
    }
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
