import type Anthropic from "@anthropic-ai/sdk";
import { type LlmMessage, LlmRefusalError } from "@lib/provider/src";
import { z } from "zod";
import { AnthropicLlmProvider, toAnthropicMessages } from "./anthropic-llm.provider";

const usage = { input_tokens: 50, output_tokens: 20, cache_read_input_tokens: 4000, cache_creation_input_tokens: 70 };

function textResponse(text: string, stopReason = "end_turn") {
  return { content: [{ type: "text", text }], usage, stop_reason: stopReason };
}

async function* streamEvents(events: unknown[]) {
  for (const event of events) {
    yield event;
  }
}

describe("AnthropicLlmProvider", () => {
  let provider: AnthropicLlmProvider;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    mockCreate = jest.fn();
    provider = new AnthropicLlmProvider({ messages: { create: mockCreate } } as unknown as Anthropic);
  });

  describe("generate", () => {
    it("sends the main profile with a cached system prompt", async () => {
      mockCreate.mockResolvedValue(textResponse("Hello, I am Jake!"));

      const messages: LlmMessage[] = [{ role: "user", content: "Hi Jake" }];
      const result = await provider.generate("System prompt", messages);

      expect(mockCreate).toHaveBeenCalledWith({
        model: "claude-sonnet-5-5",
        max_tokens: 1024,
        thinking: { type: "between_tools" },
        output_config: { effort: "low" },
        system: [{ type: "text", text: "System prompt", cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: "Hi Jake" }],
      });
      expect(result).toEqual({
        text: "Hello, I am Jake!",
        inputTokens: 50,
        outputTokens: 20,
        cacheReadInputTokens: 4000,
        cacheCreationInputTokens: 70,
        refused: false,
      });
    });

    it("uses the fast profile and custom maxTokens", async () => {
      mockCreate.mockResolvedValue(textResponse("ok"));

      await provider.generate("System", [{ role: "user", content: "test" }], { tier: "fast", maxTokens: 2048 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "claude-haiku-5-5", thinking: { type: "disabled" }, max_tokens: 2048 }),
      );
    });

    it("joins text blocks and ignores other blocks", async () => {
      mockCreate.mockResolvedValue({
        content: [
          { type: "thinking", thinking: "" },
          { type: "text", text: "Part 1 " },
          { type: "text", text: "Part 2" },
        ],
        usage,
        stop_reason: "end_turn",
      });

      const result = await provider.generate("System", [{ role: "user", content: "test" }]);
      expect(result.text).toBe("Part 1 Part 2");
    });

    it("reports a refusal", async () => {
      mockCreate.mockResolvedValue(textResponse("", "refusal"));

      const result = await provider.generate("System", [{ role: "user", content: "test" }]);
      expect(result.refused).toBe(true);
    });

    it("propagates API errors", async () => {
      mockCreate.mockRejectedValue(new Error("API rate limit exceeded"));

      await expect(provider.generate("System", [{ role: "user", content: "test" }])).rejects.toThrow(
        "API rate limit exceeded",
      );
    });
  });

  describe("generateStream", () => {
    it("streams text, collects usage and passes the abort signal", async () => {
      mockCreate.mockResolvedValue(
        streamEvents([
          { type: "message_start", message: { usage: { ...usage, output_tokens: 1 } } },
          { type: "content_block_delta", delta: { type: "text_delta", text: "Hi " } },
          { type: "content_block_delta", delta: { type: "text_delta", text: "there" } },
          { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 12 } },
        ]),
      );
      const onText = jest.fn();
      const onDone = jest.fn();
      const signal = new AbortController().signal;

      const result = await provider.generateStream(
        "System",
        [{ role: "user", content: "Hello" }],
        { onText, onDone },
        { signal, cacheConversation: true },
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
          messages: [
            { role: "user", content: [{ type: "text", text: "Hello", cache_control: { type: "ephemeral" } }] },
          ],
        }),
        { signal },
      );
      expect(onText.mock.calls).toEqual([["Hi "], ["there"]]);
      expect(result).toEqual({
        text: "Hi there",
        inputTokens: 50,
        outputTokens: 12,
        cacheReadInputTokens: 4000,
        cacheCreationInputTokens: 70,
        refused: false,
      });
      expect(onDone).toHaveBeenCalledWith(result);
    });

    it("reports a refusal that ends the stream", async () => {
      mockCreate.mockResolvedValue(
        streamEvents([
          { type: "message_start", message: { usage } },
          { type: "content_block_delta", delta: { type: "text_delta", text: "Sure, " } },
          { type: "message_delta", delta: { stop_reason: "refusal" }, usage: { output_tokens: 2 } },
        ]),
      );

      const result = await provider.generateStream("System", [{ role: "user", content: "x" }], {
        onText: jest.fn(),
        onDone: jest.fn(),
      });
      expect(result.refused).toBe(true);
    });
  });

  describe("generateJson", () => {
    const schema = z.object({ name: z.string(), score: z.number().min(0).max(1), note: z.string().nullable() });

    it("requests structured output and parses the JSON text", async () => {
      mockCreate.mockResolvedValue(textResponse('{"name":"Jake","score":0.5,"note":"null"}'));

      const result = await provider.generateJson("System", [{ role: "user", content: "test" }], schema);

      const request = mockCreate.mock.calls[0]?.[0];
      expect(request.max_tokens).toBe(4096);
      expect(request.tool_choice).toBeUndefined();
      expect(request.output_config).toEqual({
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              score: { type: "number" },
              note: { anyOf: [{ type: "string" }, { type: "null" }] },
            },
            required: ["name", "score", "note"],
            additionalProperties: false,
          },
        },
      });
      expect(result).toEqual({ name: "Jake", score: 0.5, note: null });
    });

    it("throws on a refusal", async () => {
      mockCreate.mockResolvedValue(textResponse("", "refusal"));

      await expect(provider.generateJson("System", [{ role: "user", content: "test" }], schema)).rejects.toBeInstanceOf(
        LlmRefusalError,
      );
    });

    it("throws when the output was cut off", async () => {
      mockCreate.mockResolvedValue(textResponse('{"name":"Ja', "max_tokens"));

      await expect(provider.generateJson("System", [{ role: "user", content: "test" }], schema)).rejects.toThrow(
        "max_tokens",
      );
    });

    it("throws on invalid JSON", async () => {
      mockCreate.mockResolvedValue(textResponse("not json"));

      await expect(provider.generateJson("System", [{ role: "user", content: "test" }], schema)).rejects.toThrow(
        "invalid JSON",
      );
    });

    it("enforces constraints the API schema drops", async () => {
      mockCreate.mockResolvedValue(textResponse('{"name":"Jake","score":7,"note":null}'));

      await expect(provider.generateJson("System", [{ role: "user", content: "test" }], schema)).rejects.toThrow(
        "validation failed",
      );
    });
  });
});

describe("toAnthropicMessages", () => {
  it("marks the last user message, not a trailing system note, as the cache breakpoint", () => {
    const messages: LlmMessage[] = [
      { role: "assistant", content: "Hey!" },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "How are you?" },
      { role: "user", content: "Tired" },
      { role: "system", content: "Voice note" },
    ];

    expect(toAnthropicMessages(messages, true)).toEqual([
      { role: "assistant", content: "Hey!" },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "How are you?" },
      { role: "user", content: [{ type: "text", text: "Tired", cache_control: { type: "ephemeral" } }] },
      { role: "system", content: "Voice note" },
    ]);
  });

  it("keeps a system note between a user message and the reply", () => {
    const messages: LlmMessage[] = [
      { role: "user", content: "Hi" },
      { role: "system", content: "Voice note" },
      { role: "assistant", content: "Feeling okay?" },
      { role: "user", content: "Yes" },
    ];

    expect(toAnthropicMessages(messages, false)).toEqual(messages);
  });

  it("drops empty messages and system notes the API would reject", () => {
    const messages: LlmMessage[] = [
      { role: "system", content: "first" },
      { role: "assistant", content: "Hey!" },
      { role: "user", content: "Hi" },
      { role: "system", content: "followed by a user message" },
      { role: "assistant", content: "  " },
      { role: "user", content: "Hello?" },
    ];

    expect(toAnthropicMessages(messages, false)).toEqual([
      { role: "assistant", content: "Hey!" },
      { role: "user", content: "Hi" },
      { role: "user", content: "Hello?" },
    ]);
  });
});
