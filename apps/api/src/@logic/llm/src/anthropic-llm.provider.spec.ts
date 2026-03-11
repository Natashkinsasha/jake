import type Anthropic from "@anthropic-ai/sdk";
import type { LlmMessage } from "@lib/provider/src";
import { z } from "zod";
import { AnthropicLlmProvider } from "./anthropic-llm.provider";

describe("AnthropicLlmProvider", () => {
  let provider: AnthropicLlmProvider;
  let mockCreate: jest.Mock;
  let mockClient: Anthropic;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCreate = jest.fn();
    mockClient = { messages: { create: mockCreate } } as unknown as Anthropic;

    provider = new AnthropicLlmProvider(mockClient);
  });

  describe("generate", () => {
    it("should call Anthropic API with correct parameters", async () => {
      const mockResponse = {
        content: [{ type: "text", text: "Hello, I am Jake!" }],
        usage: { input_tokens: 50, output_tokens: 20 },
      };
      mockCreate.mockResolvedValue(mockResponse);

      const messages: LlmMessage[] = [{ role: "user", content: "Hi Jake" }];
      const result = await provider.generate("System prompt", messages);

      expect(mockCreate).toHaveBeenCalledWith({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: [{ type: "text", text: "System prompt", cache_control: { type: "ephemeral" } }],
        messages,
      });

      expect(result).toEqual({
        text: "Hello, I am Jake!",
        inputTokens: 50,
        outputTokens: 20,
      });
    });

    it("should use custom maxTokens when provided", async () => {
      const mockResponse = {
        content: [{ type: "text", text: "Response" }],
        usage: { input_tokens: 10, output_tokens: 5 },
      };
      mockCreate.mockResolvedValue(mockResponse);

      await provider.generate("System", [{ role: "user", content: "test" }], 2048);

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 2048 }));
    });

    it("should concatenate multiple text blocks", async () => {
      const mockResponse = {
        content: [
          { type: "text", text: "Part 1 " },
          { type: "text", text: "Part 2" },
        ],
        usage: { input_tokens: 30, output_tokens: 15 },
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await provider.generate("System", [{ role: "user", content: "test" }]);
      expect(result.text).toBe("Part 1 Part 2");
    });

    it("should filter out non-text blocks", async () => {
      const mockResponse = {
        content: [
          { type: "text", text: "Hello" },
          { type: "tool_use", id: "tool-1", name: "test", input: {} },
        ],
        usage: { input_tokens: 30, output_tokens: 15 },
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await provider.generate("System", [{ role: "user", content: "test" }]);
      expect(result.text).toBe("Hello");
    });

    it("should propagate API errors", async () => {
      mockCreate.mockRejectedValue(new Error("API rate limit exceeded"));

      await expect(provider.generate("System", [{ role: "user", content: "test" }])).rejects.toThrow(
        "API rate limit exceeded",
      );
    });

    it("should return empty text when no text blocks exist", async () => {
      const mockResponse = {
        content: [],
        usage: { input_tokens: 10, output_tokens: 0 },
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await provider.generate("System", [{ role: "user", content: "test" }]);
      expect(result.text).toBe("");
    });
  });

  describe("generateJson", () => {
    const schema = z.object({ name: z.string() });

    it("should use tool_use and return parsed result", async () => {
      const mockResponse = {
        content: [{ type: "tool_use", id: "t1", name: "output", input: { name: "Jake" } }],
        usage: { input_tokens: 50, output_tokens: 20 },
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await provider.generateJson("System", [{ role: "user", content: "test" }], schema);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.arrayContaining([expect.objectContaining({ name: "output" })]),
          tool_choice: { type: "tool", name: "output" },
        }),
      );
      expect(result).toEqual({ name: "Jake" });
    });

    it("should use default maxTokens of 2048", async () => {
      const mockResponse = {
        content: [{ type: "tool_use", id: "t1", name: "output", input: { name: "Jake" } }],
        usage: { input_tokens: 10, output_tokens: 5 },
      };
      mockCreate.mockResolvedValue(mockResponse);

      await provider.generateJson("System", [{ role: "user", content: "test" }], schema);

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 2048 }));
    });

    it("should throw when no tool_use block in response", async () => {
      const mockResponse = {
        content: [{ type: "text", text: "no tool use" }],
        usage: { input_tokens: 50, output_tokens: 20 },
      };
      mockCreate.mockResolvedValue(mockResponse);

      await expect(provider.generateJson("System", [{ role: "user", content: "test" }], schema)).rejects.toThrow(
        "No tool_use block",
      );
    });

    it("should throw when schema validation fails", async () => {
      const mockResponse = {
        content: [{ type: "tool_use", id: "t1", name: "output", input: { bad: "data" } }],
        usage: { input_tokens: 50, output_tokens: 20 },
      };
      mockCreate.mockResolvedValue(mockResponse);

      await expect(provider.generateJson("System", [{ role: "user", content: "test" }], schema)).rejects.toThrow(
        "validation failed",
      );
    });
  });
});
