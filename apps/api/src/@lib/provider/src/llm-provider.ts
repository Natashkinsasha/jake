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

export abstract class LlmProvider {
  abstract generate(
    systemPrompt: string,
    messages: LlmMessage[],
    maxTokens?: number,
  ): Promise<LlmResponse>;

  abstract generateJson<T>(
    systemPrompt: string,
    messages: LlmMessage[],
    maxTokens?: number,
    schema?: ZodSchema<T>,
  ): Promise<T>;
}
