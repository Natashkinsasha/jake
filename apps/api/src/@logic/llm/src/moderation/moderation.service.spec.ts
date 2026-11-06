import { type LlmProvider, LlmRefusalError } from "@lib/provider/src";
import { ModerationService } from "./moderation.service";

describe("ModerationService.llmCheck", () => {
  const withClassifier = (generateJson: jest.Mock) => new ModerationService({ generateJson } as unknown as LlmProvider);

  it("returns the classifier verdict from the fast tier", async () => {
    const generateJson = jest.fn(async () => ({ is_safe: false, reason: "toxicity", confidence: 0.8 }));

    await expect(withClassifier(generateJson).llmCheck("text")).resolves.toEqual({
      isSafe: false,
      reason: "toxicity",
      confidence: 0.8,
    });
    expect(generateJson).toHaveBeenCalledWith(
      expect.any(String),
      [{ role: "user", content: "text" }],
      expect.anything(),
      expect.objectContaining({ tier: "fast" }),
    );
  });

  it("lets a message through when the classifier refuses, and says so", async () => {
    const generateJson = jest.fn(async () => {
      throw new LlmRefusalError("refused");
    });

    await expect(withClassifier(generateJson).llmCheck("text")).resolves.toEqual({
      isSafe: true,
      reason: "classifier_refused",
      confidence: 0,
    });
  });

  it("fails open when the classifier is down", async () => {
    const generateJson = jest.fn(async () => {
      throw new Error("503");
    });

    await expect(withClassifier(generateJson).llmCheck("text")).resolves.toEqual({
      isSafe: true,
      reason: null,
      confidence: 0,
    });
  });
});
