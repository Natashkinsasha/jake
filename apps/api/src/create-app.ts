import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { IoAdapter } from "@nestjs/platform-socket.io";

export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  });

  const ioAdapter = new IoAdapter(app);
  (ioAdapter as any).createIOServer = function (port: number, options?: any) {
    return IoAdapter.prototype.createIOServer.call(this, port, {
      ...options,
      maxHttpBufferSize: 10 * 1024 * 1024, // 10MB for base64 audio
    });
  };
  app.useWebSocketAdapter(ioAdapter);

  return app;
}
