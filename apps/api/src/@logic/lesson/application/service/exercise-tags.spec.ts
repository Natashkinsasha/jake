import { ExerciseTagBuffer, extractExerciseTag } from "./exercise-tags";

describe("extractExerciseTag", () => {
  it("extracts a matching exercise from text", () => {
    const text = `Let's practice! Try matching these words.
<exercise type="matching">
  <pair word="resilient" definition="able to recover quickly from difficulties"/>
  <pair word="reluctant" definition="unwilling and hesitant"/>
</exercise>`;

    const result = extractExerciseTag(text);
    expect(result.cleanText).toBe("Let's practice! Try matching these words.");
    expect(result.exercise).toEqual({
      type: "matching",
      pairs: [
        { word: "resilient", definition: "able to recover quickly from difficulties" },
        { word: "reluctant", definition: "unwilling and hesitant" },
      ],
    });
  });

  it("returns null exercise when no tag present", () => {
    const result = extractExerciseTag("Just a normal response.");
    expect(result.cleanText).toBe("Just a normal response.");
    expect(result.exercise).toBeNull();
  });

  it("handles single-line pairs", () => {
    const text =
      'Practice time! <exercise type="matching"><pair word="a" definition="b"/><pair word="c" definition="d"/></exercise>';
    const result = extractExerciseTag(text);
    expect(result.exercise?.pairs).toHaveLength(2);
    expect(result.cleanText).toBe("Practice time!");
  });
});

describe("ExerciseTagBuffer", () => {
  it("buffers incomplete exercise tag across chunks", () => {
    const buffer = new ExerciseTagBuffer();

    const r1 = buffer.push("Let's practice! <exercise typ");
    expect(r1.cleanText).toBe("Let's practice! ");
    expect(r1.exercise).toBeNull();

    const r2 = buffer.push('e="matching"><pair word="a" definition="b"/></exercise>');
    expect(r2.exercise).toEqual({
      type: "matching",
      pairs: [{ word: "a", definition: "b" }],
    });
  });

  it("passes through text when no exercise tag", () => {
    const buffer = new ExerciseTagBuffer();
    const r = buffer.push("Hello, how are you?");
    expect(r.cleanText).toBe("Hello, how are you?");
    expect(r.exercise).toBeNull();
  });

  it("flushes remaining buffer with incomplete tag", () => {
    const buffer = new ExerciseTagBuffer();
    const r1 = buffer.push("Some text <exercise");
    // "Some text " is safe, "<exercise" is buffered as partial prefix
    expect(r1.cleanText).toBe("Some text ");
    expect(r1.exercise).toBeNull();

    const r2 = buffer.flush();
    // Incomplete tag — no exercise parsed, raw fragment returned
    expect(r2.cleanText).toBe("<exercise");
    expect(r2.exercise).toBeNull();
  });

  it("buffers inner <pair> tags without flushing exercise content", () => {
    const buffer = new ExerciseTagBuffer();

    // Sentence buffer sends the intro text first
    const r1 = buffer.push("Got it! Here's a quick matching exercise for you.");
    expect(r1.cleanText).toBe("Got it! Here's a quick matching exercise for you.");
    expect(r1.exercise).toBeNull();

    // Then the opening exercise tag as a separate chunk
    const r2 = buffer.push('<exercise type="matching">');
    expect(r2.cleanText).toBe("");
    expect(r2.exercise).toBeNull();

    // Inner pair tags arrive as separate chunks — must NOT leak
    const r3 = buffer.push('<pair word="debugging" definition="finding errors"/>');
    expect(r3.cleanText).toBe("");
    expect(r3.exercise).toBeNull();

    const r4 = buffer.push('<pair word="commute" definition="journey to work"/>');
    expect(r4.cleanText).toBe("");
    expect(r4.exercise).toBeNull();

    // Closing tag arrives — exercise extracted
    const r5 = buffer.push("</exercise>");
    expect(r5.exercise).toEqual({
      type: "matching",
      pairs: [
        { word: "debugging", definition: "finding errors" },
        { word: "commute", definition: "journey to work" },
      ],
    });
    expect(r5.cleanText).toBe("");
  });

  it("handles exercise tag split across many small chunks", () => {
    const buffer = new ExerciseTagBuffer();

    const r0 = buffer.push("Try this ");
    expect(r0.cleanText).toBe("Try this ");

    const r1 = buffer.push("<exer");
    expect(r1.cleanText).toBe("");
    expect(r1.exercise).toBeNull();

    buffer.push('cise type="matching">');
    buffer.push('<pair word="a" definition="b"/>');
    const r2 = buffer.push("</exercise>");
    expect(r2.exercise).toEqual({
      type: "matching",
      pairs: [{ word: "a", definition: "b" }],
    });
  });
});
