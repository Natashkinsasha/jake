import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log("Worker started — processing background jobs");

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("Worker shutting down...");
    void app.close().then(() => process.exit(0));
  });

  process.on("SIGINT", () => {
    console.log("Worker shutting down...");
    void app.close().then(() => process.exit(0));
  });
}

bootstrap().catch((err: unknown) => {
  console.error("Worker bootstrap failed:", err);
  process.exit(1);
});
