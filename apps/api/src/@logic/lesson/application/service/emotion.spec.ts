import { parseEmotion, getVoiceSettingsForEmotion, EMOTIONS, type Emotion } from "./emotion";

describe("parseEmotion", () => {
  it("should extract emotion tag from start of text", () => {
    const result = parseEmotion("<emotion>happy</emotion>Great job today!");
    expect(result).toEqual({ emotion: "happy", text: "Great job today!" });
  });

  it("should return neutral when no tag present", () => {
    const result = parseEmotion("Just a normal message.");
    expect(result).toEqual({ emotion: "neutral", text: "Just a normal message." });
  });

  it("should return neutral for invalid emotion name", () => {
    const result = parseEmotion("<emotion>angry</emotion>Hey there!");
    expect(result).toEqual({ emotion: "neutral", text: "Hey there!" });
  });

  it("should handle whitespace around tag", () => {
    const result = parseEmotion("  <emotion>excited</emotion>  Wow, amazing!");
    expect(result).toEqual({ emotion: "excited", text: "Wow, amazing!" });
  });

  it("should handle tag with no following text", () => {
    const result = parseEmotion("<emotion>curious</emotion>");
    expect(result).toEqual({ emotion: "curious", text: "" });
  });

  it("should handle emotion tag mid-text (only first match)", () => {
    const result = parseEmotion("Hello <emotion>happy</emotion>world");
    expect(result).toEqual({ emotion: "happy", text: "Hello world" });
  });
});

describe("getVoiceSettingsForEmotion", () => {
  it("should return specific settings for known emotions", () => {
    const settings = getVoiceSettingsForEmotion("excited");
    expect(settings.stability).toBe(0.3);
    expect(settings.similarity_boost).toBe(0.7);
    expect(settings.style).toBe(0.8);
  });

  it("should return neutral settings for unknown emotion", () => {
    const settings = getVoiceSettingsForEmotion("unknown" as Emotion);
    expect(settings.stability).toBe(0.5);
    expect(settings.similarity_boost).toBe(0.75);
    expect(settings.style).toBe(0.0);
  });

  it("should have settings for all defined emotions", () => {
    for (const emotion of EMOTIONS) {
      const settings = getVoiceSettingsForEmotion(emotion);
      expect(settings).toHaveProperty("stability");
      expect(settings).toHaveProperty("similarity_boost");
      expect(settings).toHaveProperty("style");
    }
  });
});
