import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { AnthropicInstrumentation } from "@arizeai/openinference-instrumentation-anthropic";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import { trace, SpanStatusCode, type Attributes } from "@opentelemetry/api";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

let sdk: NodeSDK | null = null;

export function initTracing(): void {
  const publicKey = process.env["LANGFUSE_PUBLIC_KEY"];
  const secretKey = process.env["LANGFUSE_SECRET_KEY"];

  if (!publicKey || !secretKey) {
    console.log("Langfuse keys not set — tracing disabled");
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
  console.log("Langfuse tracing initialized");
}

export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    console.log("Langfuse tracing shut down");
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
      if (onSuccess) span.setAttributes(toLangfuseMetadata(onSuccess(result)));
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
