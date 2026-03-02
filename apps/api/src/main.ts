import { createApp } from "./create-app";

async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT || 4000;
  await app.listen(port, "0.0.0.0");
  console.log(`API running on port ${port}`);

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully…`);
    await app.close();
    console.log("App closed");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
bootstrap();
