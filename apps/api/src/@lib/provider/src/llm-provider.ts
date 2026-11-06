import type { ZodSchema } from "zod";

export interface LlmMessage {
  // "system" is an operator note inside the conversation; it must directly follow a user message.
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LlmResponse {
  text: string;
  // Input tokens billed at full price; cached prefix tokens are counted separately below.
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  // The model declined to answer for safety reasons; text may be empty or partial.
  refused: boolean;
}

// The model declined to answer for safety reasons.
export class LlmRefusalError extends Error {
  override name = "LlmRefusalError";
}

export interface LlmStreamCallbacks {
  onText(delta: string): void;
  onDone(response: LlmResponse): void;
}

// "main" is the tutor model, "fast" is a cheap model for classification.
export type LlmTier = "main" | "fast";

export interface LlmRequestOptions {
  tier?: LlmTier;
  maxTokens?: number;
  spanName?: string;
  // Cache the conversation up to the last user message so the next turn reads it back.
  cacheConversation?: boolean;
}

export abstract class LlmProvider {
  abstract generate(systemPrompt: string, messages: LlmMessage[], options?: LlmRequestOptions): Promise<LlmResponse>;

  abstract generateStream(
    systemPrompt: string,
    messages: LlmMessage[],
    callbacks: LlmStreamCallbacks,
    options?: LlmRequestOptions & { signal?: AbortSignal },
  ): Promise<LlmResponse>;

  abstract generateJson<T>(
    systemPrompt: string,
    messages: LlmMessage[],
    schema: ZodSchema<T>,
    options?: LlmRequestOptions,
  ): Promise<T>;
}
