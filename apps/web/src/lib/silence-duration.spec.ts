import { getSilenceDuration, SILENCE_DURATIONS } from "./silence-duration";

describe("getSilenceDuration", () => {
  it("returns period duration for sentences ending with .", () => {
    expect(getSilenceDuration("I went to the store.")).toBe(SILENCE_DURATIONS.period);
  });

  it("returns question duration for questions", () => {
    expect(getSilenceDuration("What do you think?")).toBe(SILENCE_DURATIONS.question);
  });

  it("returns exclamation duration", () => {
    expect(getSilenceDuration("That's great!")).toBe(SILENCE_DURATIONS.exclamation);
  });

  it("returns ellipsis duration for trailing dots", () => {
    expect(getSilenceDuration("I think...")).toBe(SILENCE_DURATIONS.ellipsis);
    expect(getSilenceDuration("Well\u2026")).toBe(SILENCE_DURATIONS.ellipsis);
  });

  it("returns noPunctuation for incomplete text", () => {
    expect(getSilenceDuration("I went to the")).toBe(SILENCE_DURATIONS.noPunctuation);
  });

  it("handles trailing whitespace", () => {
    expect(getSilenceDuration("Hello.  ")).toBe(SILENCE_DURATIONS.period);
  });

  it("handles empty string", () => {
    expect(getSilenceDuration("")).toBe(SILENCE_DURATIONS.noPunctuation);
  });
});
