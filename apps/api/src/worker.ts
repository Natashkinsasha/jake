import "dotenv/config";
import { initTracing, shutdownTracing } from "./@lib/llm/src/llm-tracing";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

initTracing();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log("Worker started — processing background jobs");

  const shutdown = async () => {
    console.log("Worker shutting down...");
    await app.close();
    await shutdownTracing();
    process.exit(0);
  };

  process.on("SIGTERM", () => { void shutdown(); });
  process.on("SIGINT", () => { void shutdown(); });
}

bootstrap().catch((err: unknown) => {
  console.error("Worker bootstrap failed:", err);
  process.exit(1);
});
