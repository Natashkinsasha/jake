import { isBackchannel } from "./backchannel";

describe("isBackchannel", () => {
  it("detects single-word backchannels", () => {
    expect(isBackchannel("yeah")).toBe(true);
    expect(isBackchannel("Ok")).toBe(true);
    expect(isBackchannel("Mm-hmm")).toBe(true);
    expect(isBackchannel("Sure")).toBe(true);
  });

  it("detects known multi-word backchannel phrases", () => {
    expect(isBackchannel("I see")).toBe(true);
    expect(isBackchannel("got it")).toBe(true);
    expect(isBackchannel("thank you")).toBe(true);
  });

  it("rejects real sentences", () => {
    expect(isBackchannel("I want to practice grammar")).toBe(false);
    expect(isBackchannel("Can we talk about travel")).toBe(false);
    expect(isBackchannel("Let me think about that")).toBe(false);
  });

  it("handles punctuation", () => {
    expect(isBackchannel("Yeah!")).toBe(true);
    expect(isBackchannel("Ok.")).toBe(true);
  });

  it("allows two-word non-backchannel phrases", () => {
    expect(isBackchannel("hello there")).toBe(false);
    expect(isBackchannel("new topic")).toBe(false);
  });

  it("allows action phrases that should interrupt", () => {
    expect(isBackchannel("stop")).toBe(false);
    expect(isBackchannel("wait")).toBe(false);
    expect(isBackchannel("help me")).toBe(false);
    expect(isBackchannel("slow down")).toBe(false);
  });

  it("treats single unknown word as backchannel", () => {
    expect(isBackchannel("banana")).toBe(true);
  });
});
