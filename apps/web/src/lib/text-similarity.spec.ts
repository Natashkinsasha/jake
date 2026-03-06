import { textSimilarity, shouldAbortForRevision } from "./text-similarity";

describe("textSimilarity", () => {
  it("returns 1.0 for identical text", () => {
    expect(textSimilarity("hello world", "hello world")).toBe(1.0);
  });

  it("returns 0.0 for completely different text", () => {
    expect(textSimilarity("hello world", "foo bar")).toBe(0.0);
  });

  it("returns partial similarity for overlapping text", () => {
    const sim = textSimilarity("I like pizza", "I like pasta");
    expect(sim).toBeGreaterThan(0.3);
    expect(sim).toBeLessThan(0.9);
  });

  it("handles empty strings", () => {
    expect(textSimilarity("", "")).toBe(1.0);
    expect(textSimilarity("hello", "")).toBe(0.0);
  });
});

describe("shouldAbortForRevision", () => {
  it("returns false for empty lastSentText", () => {
    expect(shouldAbortForRevision("", "new text")).toBe(false);
  });

  it("returns false for similar text", () => {
    expect(shouldAbortForRevision(
      "I want to practice my English",
      "I want to practice my English today",
    )).toBe(false);
  });

  it("returns true for very different text", () => {
    expect(shouldAbortForRevision(
      "I want to practice my English",
      "Let's talk about cooking recipes",
    )).toBe(true);
  });
});
