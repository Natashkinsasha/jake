import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { IoAdapter } from "@nestjs/platform-socket.io";

class CustomIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: Record<string, unknown>) {
    return super.createIOServer(port, {
      ...options,
      maxHttpBufferSize: 10 * 1024 * 1024, // 10MB for base64 audio
    });
  }
}

export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  });

  app.useWebSocketAdapter(new CustomIoAdapter(app));

  return app;
}
