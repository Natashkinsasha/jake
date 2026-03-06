import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Logger, UseGuards } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { z } from "zod";
import { WsAuthGuard } from "@shared/shared-ws/ws-auth.guard";
import { LessonMaintainer, toSpeechSpeed } from "../../application/maintainer/lesson.maintainer";
import { LessonSessionService } from "../../application/service/lesson-session.service";
import { VoicePrintService } from "../../application/service/voice-print.service";

interface SocketData {
  userId: string;
  voiceSampleProcessed?: boolean;
}

const MAX_VOICE_SAMPLE_BYTES = 512 * 1024; // 512KB

const wsTextMessageSchema = z.object({
  text: z.string().min(1),
  messageId: z.string().optional(),
});

const wsSetSpeedSchema = z.object({
  speed: z.enum(["very_slow", "slow", "normal", "fast", "very_fast"]),
});

@WebSocketGateway({ namespace: "/ws/lesson", cors: true })
@UseGuards(WsAuthGuard)
export class LessonGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LessonGateway.name);
  private abortControllers = new Map<string, AbortController>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private lessonMaintainer: LessonMaintainer,
    private sessionService: LessonSessionService,
    private jwtService: JwtService,
    private voicePrintService: VoicePrintService,
  ) {}

  async handleConnection(client: Socket) {
    // Guards don't run for handleConnection, authenticate manually
    const token =
      (client.handshake.auth as Record<string, unknown>)["token"] ??
      client.handshake.query["token"];

    if (token == null) {
      client.emit("error", { message: "No auth token" });
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token as string);
      (client.data as SocketData) = { userId: payload.sub };
    } catch {
      client.emit("error", { message: "Invalid token" });
      client.disconnect();
      return;
    }

    const userId = (client.data as SocketData).userId;

    try {
      const result = await this.lessonMaintainer.startLesson(userId);

      await this.sessionService.save(client.id, {
        lessonId: result.lessonId,
        systemPrompt: result.systemPrompt,
        voiceId: result.voiceId,
        speechSpeed: result.speechSpeed,
        history: [{ role: "assistant", content: result.greeting.text }],
      });

      client.emit("lesson_started", {
        lessonId: result.lessonId,
        voiceId: result.voiceId,
        speechSpeed: result.speechSpeed,
        ttsModel: result.ttsModel,
        systemPrompt: result.systemPrompt,
      });

      client.emit("tutor_chunk", { chunkIndex: 0, text: result.greeting.text });
      client.emit("tutor_stream_end", { fullText: result.greeting.text });
    } catch (error: unknown) {
      this.logger.error(`Failed to start lesson: ${error instanceof Error ? error.message : String(error)}`);
      client.emit("error", { message: "Failed to start lesson" });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    this.abortControllers.get(client.id)?.abort();
    this.abortControllers.delete(client.id);

    const session = await this.sessionService.get(client.id);
    if (session) {
      await this.lessonMaintainer.endLesson(session.lessonId, session.history);
      await this.sessionService.delete(client.id);
    }
  }

  @SubscribeMessage("text")
  async handleText(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ) {
    const parsed = wsTextMessageSchema.safeParse(data);
    if (!parsed.success) {
      client.emit("error", { message: "Invalid text message" });
      return;
    }

    const userId = (client.data as SocketData).userId;

    // Cancel any in-flight generation
    this.abortControllers.get(client.id)?.abort();
    const abortController = new AbortController();
    this.abortControllers.set(client.id, abortController);

    const messageId = parsed.data.messageId;

    client.emit("status", { state: "thinking" });

    await this.lessonMaintainer.processTextMessageStreaming(
      client.id,
      userId,
      parsed.data.text,
      {
        onChunk: (chunk) => {
          client.emit("tutor_chunk", { ...chunk, messageId });
        },
        onEnd: (result) => {
          this.abortControllers.delete(client.id);
          client.emit("tutor_stream_end", {
            fullText: result.fullText,
            messageId,
          });
        },
        onError: (error) => {
          this.abortControllers.delete(client.id);
          this.logger.error(`Streaming failed: ${error.message}`);
          client.emit("error", { message: "Something went wrong!" });
        },
        onDiscard: (safetyText) => {
          this.abortControllers.delete(client.id);
          client.emit("tutor_stream_end", { discarded: true, messageId });
          client.emit("tutor_message", { text: safetyText });
        },
        onSpeedChange: (speed) => {
          client.emit("speed_updated", { speed });
        },
      },
      { signal: abortController.signal },
    );
  }

  @SubscribeMessage("interrupt")
  handleInterrupt(@ConnectedSocket() client: Socket) {
    const controller = this.abortControllers.get(client.id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(client.id);
      this.logger.debug(`Interrupted streaming for ${client.id}`);
    }
  }

  @SubscribeMessage("set_speed")
  async handleSetSpeed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ) {
    const parsed = wsSetSpeedSchema.safeParse(data);
    if (!parsed.success) {
      client.emit("error", { message: "Invalid speed value" });
      return;
    }

    const session = await this.sessionService.get(client.id);
    if (!session) return;

    const speed = toSpeechSpeed(parsed.data.speed);
    await this.sessionService.updateSpeechSpeed(client.id, speed);

    client.emit("speed_updated", { speed: parsed.data.speed });
  }

  @SubscribeMessage("voice_sample")
  async handleVoiceSample(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { audio: string },
  ) {
    if (!data.audio) return;

    const socketData = client.data as SocketData;
    if (socketData.voiceSampleProcessed) return;
    socketData.voiceSampleProcessed = true;

    const userId = socketData.userId;

    try {
      const audioBuffer = Buffer.from(data.audio, "base64");
      if (audioBuffer.length > MAX_VOICE_SAMPLE_BYTES) {
        this.logger.warn(`Voice sample too large (${audioBuffer.length} bytes) from user ${userId}`);
        return;
      }
      const result = await this.voicePrintService.processVoiceSample(userId, audioBuffer);

      if (result.status === "mismatch") {
        await this.sessionService.setVoiceMismatch(client.id, true);
        this.logger.log(`Voice mismatch detected for user ${userId}, similarity: ${result.similarity?.toFixed(3)}`);
      }
    } catch (error) {
      this.logger.error(`Voice sample processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  @SubscribeMessage("end_lesson")
  async handleEndLesson(@ConnectedSocket() client: Socket) {
    const session = await this.sessionService.get(client.id);
    if (!session) return;

    await this.lessonMaintainer.endLesson(session.lessonId, session.history);
    await this.sessionService.delete(client.id);

    client.emit("lesson_ended", { lessonId: session.lessonId });
    client.disconnect();
  }
}
