import Anthropic from "@anthropic-ai/sdk";
import { AnthropicInstrumentation } from "@arizeai/openinference-instrumentation-anthropic";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { type Attributes, SpanStatusCode, trace } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import OpenAI from "openai";

let sdk: NodeSDK | null = null;

export function initTracing(): void {
  const publicKey = process.env["LANGFUSE_PUBLIC_KEY"];
  const secretKey = process.env["LANGFUSE_SECRET_KEY"];

  if (!(publicKey && secretKey)) {
    return;
  }

  const anthropicInstrumentation = new AnthropicInstrumentation();
  anthropicInstrumentation.manuallyInstrument(Anthropic);

  const openaiInstrumentation = new OpenAIInstrumentation();
  openaiInstrumentation.manuallyInstrument(OpenAI);

  sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor({ environment: process.env["NODE_ENV"] })],
    instrumentations: [anthropicInstrumentation, openaiInstrumentation],
    serviceName: "jake-api",
  });

  sdk.start();
}

export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
  }
}

function toLangfuseMetadata(attrs: Attributes): Attributes {
  const out: Attributes = {};
  for (const [key, value] of Object.entries(attrs)) {
    out[`langfuse.span.metadata.${key}`] = value;
  }
  return out;
}

export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: () => Promise<T>,
  onSuccess?: (result: T) => Attributes,
): Promise<T> {
  const tracer = trace.getTracer("jake-api");
  return tracer.startActiveSpan(name, async (span) => {
    span.setAttributes(toLangfuseMetadata(attributes));
    try {
      const result = await fn();
      if (onSuccess) {
        span.setAttributes(toLangfuseMetadata(onSuccess(result)));
      }
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      span.end();
    }
  });
}
