import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log("Worker started — processing background jobs");

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("Worker shutting down...");
    await app.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("Worker shutting down...");
    await app.close();
    process.exit(0);
  });
}

bootstrap();
