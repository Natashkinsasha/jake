import type { ZodSchema } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Keywords the structured outputs API rejects. Zod still enforces them on the parsed result.
const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "default",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
]);

export function toStructuredOutputSchema(schema: ZodSchema): Record<string, unknown> {
  // biome-ignore lint/suspicious/noExplicitAny: zod-to-json-schema's input type doesn't accept ZodSchema<T> generics
  const jsonSchema = zodToJsonSchema(schema as any, { target: "jsonSchema7", $refStrategy: "none" });
  return cleanNode(jsonSchema) as Record<string, unknown>;
}

function cleanNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(cleanNode);
  }
  if (node === null || typeof node !== "object") {
    return node;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) {
      continue;
    }
    if (key === "type" && Array.isArray(value)) {
      // `type: ["string", "null"]` becomes an explicit anyOf
      out["anyOf"] = value.map((t: unknown) => ({ type: t }));
    } else {
      // Property names are data, not keywords: keep them and clean each property schema.
      out[key] = key === "properties" ? cleanProperties(value) : cleanNode(value);
    }
  }

  if (out["type"] === "object") {
    // A schema for extra keys (z.record) can't be expressed: structured outputs only allow false
    if (typeof out["additionalProperties"] === "object") {
      throw new Error("Structured outputs don't support objects with arbitrary keys (z.record)");
    }
    out["additionalProperties"] = false;
  }
  return out;
}

function cleanProperties(properties: unknown): unknown {
  if (properties === null || typeof properties !== "object") {
    return properties;
  }
  return Object.fromEntries(Object.entries(properties).map(([name, schema]) => [name, cleanNode(schema)]));
}
