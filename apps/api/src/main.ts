import "dotenv/config";
import { initTracing, shutdownTracing } from "./@logic/llm/src/llm-tracing";
import { createApp } from "./create-app";

initTracing();

async function bootstrap() {
  const app = await createApp();
  const port = process.env["PORT"] ?? 4000;
  await app.listen(port, "0.0.0.0");

  const shutdown = async (_signal: string) => {
    await app.close();
    await shutdownTracing();
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}
bootstrap().catch((_err: unknown) => {
  process.exit(1);
});
