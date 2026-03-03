import "dotenv/config";
import { initTracing, shutdownTracing } from "./@lib/llm/src/llm-tracing";
import { createApp } from "./create-app";

initTracing();

async function bootstrap() {
  const app = await createApp();
  const port = process.env["PORT"] ?? 4000;
  await app.listen(port, "0.0.0.0");
  console.log(`API running on port ${port}`);

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully…`);
    await app.close();
    await shutdownTracing();
    console.log("App closed");
    process.exit(0);
  };

  process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
  process.on("SIGINT", () => { void shutdown("SIGINT"); });
}
bootstrap().catch((err: unknown) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
