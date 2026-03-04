import type { ZodSchema } from "zod";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmStreamCallbacks {
  onText(delta: string): void;
  onDone(response: LlmResponse): void;
}

export abstract class LlmProvider {
  abstract generate(
    systemPrompt: string,
    messages: LlmMessage[],
    maxTokens?: number,
  ): Promise<LlmResponse>;

  abstract generateStream(
    systemPrompt: string,
    messages: LlmMessage[],
    callbacks: LlmStreamCallbacks,
    options?: { maxTokens?: number; signal?: AbortSignal },
  ): Promise<LlmResponse>;

  abstract generateJson<T>(
    systemPrompt: string,
    messages: LlmMessage[],
    schema: ZodSchema<T>,
    maxTokens?: number,
  ): Promise<T>;
}
