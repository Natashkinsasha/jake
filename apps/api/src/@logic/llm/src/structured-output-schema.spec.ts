import { z } from "zod";
import { toStructuredOutputSchema } from "./structured-output-schema";

describe("toStructuredOutputSchema", () => {
  it("drops unsupported keywords but keeps properties with the same names", () => {
    const schema = z.object({
      pattern: z.string().min(2).max(10),
      default: z.array(z.number().int().min(0)).min(1),
      nested: z.object({ maximum: z.boolean() }).passthrough(),
    });

    expect(toStructuredOutputSchema(schema)).toEqual({
      type: "object",
      properties: {
        pattern: { type: "string" },
        default: { type: "array", items: { type: "integer" } },
        nested: {
          type: "object",
          properties: { maximum: { type: "boolean" } },
          required: ["maximum"],
          additionalProperties: false,
        },
      },
      required: ["pattern", "default", "nested"],
      additionalProperties: false,
    });
  });

  it("rejects objects with arbitrary keys instead of forcing them empty", () => {
    expect(() => toStructuredOutputSchema(z.object({ scores: z.record(z.string(), z.number()) }))).toThrow("z.record");
  });
});
