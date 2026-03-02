import { createApp } from "./create-app";

async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT || 4000;
  await app.listen(port, "0.0.0.0");
  console.log(`API running on port ${port}`);
}
bootstrap();
