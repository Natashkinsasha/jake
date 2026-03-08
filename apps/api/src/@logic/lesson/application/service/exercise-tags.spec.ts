import { extractExerciseTag, ExerciseTagBuffer } from "./exercise-tags";

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
    const text = `Practice time! <exercise type="matching"><pair word="a" definition="b"/><pair word="c" definition="d"/></exercise>`;
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

  it("flushes remaining buffer", () => {
    const buffer = new ExerciseTagBuffer();
    buffer.push("Some text <exercise");
    const r = buffer.flush();
    expect(r.cleanText).toBe("<exercise");
    expect(r.exercise).toBeNull();
  });
});
