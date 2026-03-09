import { stripUnknownTags, UnknownTagBuffer } from "./unknown-tags";

describe("stripUnknownTags", () => {
  it("strips a self-closing tag and returns empty string", () => {
    const result = stripUnknownTags('<hint level="easy" />');
    expect(result).toBe("");
  });

  it("strips a full tag with content", () => {
    const result = stripUnknownTags("<grammar_note>Use present perfect here</grammar_note>");
    expect(result).toBe("");
  });

  it("strips unknown tags but keeps surrounding text", () => {
    const result = stripUnknownTags("Hello! <unknown_tag>inner</unknown_tag> How are you?");
    expect(result).toBe("Hello!  How are you?");
  });

  it("does not touch normal text", () => {
    const result = stripUnknownTags("Just a normal sentence with no tags.");
    expect(result).toBe("Just a normal sentence with no tags.");
  });

  it("strips multiple tags", () => {
    const result = stripUnknownTags("A <foo>bar</foo> B <baz /> C");
    expect(result).toBe("A  B  C");
  });

  it("does not strip text with angle brackets that are not tags", () => {
    const result = stripUnknownTags("3 < 5 and 10 > 7");
    expect(result).toBe("3 < 5 and 10 > 7");
  });
});

describe("UnknownTagBuffer", () => {
  it("buffers an incomplete tag across chunks", () => {
    const buffer = new UnknownTagBuffer();

    const r1 = buffer.push("Hello <unknow");
    expect(r1).toBe("Hello ");

    const r2 = buffer.push("n_tag>content</unknown_tag> world");
    expect(r2).toBe(" world");
  });

  it("passes through normal text immediately", () => {
    const buffer = new UnknownTagBuffer();
    expect(buffer.push("Hello world")).toBe("Hello world");
  });

  it("flushes incomplete tag fragment at stream end as-is", () => {
    const buffer = new UnknownTagBuffer();
    buffer.push("Text <incomplete_ta");
    const result = buffer.flush();
    // Incomplete fragment without closing `>` cannot be parsed as a tag — passes through
    expect(result).toBe("<incomplete_ta");
  });

  it("handles complete self-closing tag in one chunk", () => {
    const buffer = new UnknownTagBuffer();
    const result = buffer.push('Before <hint level="a" /> After');
    expect(result).toBe("Before  After");
  });
});
