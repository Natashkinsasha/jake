export interface LlmConfig {
  provider: "anthropic" | "openai";
  model: string;
  maxTokens: number;
}
