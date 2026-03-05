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
import { WsAuthGuard } from "../../../../@shared/shared-ws/ws-auth.guard";
import { LessonMaintainer, toSpeechSpeed } from "../../application/maintainer/lesson.maintainer";
import { LessonSessionService } from "../../application/service/lesson-session.service";
import { wsAudioMessageSchema } from "../dto/ws/ws-audio-message";
import { wsExerciseAnswerSchema } from "../dto/ws/ws-exercise-answer";

interface SocketData {
  userId: string;
}

const wsTextMessageSchema = z.object({
  text: z.string().min(1),
  messageId: z.string().optional(),
});

const wsSetSpeedSchema = z.object({
  speed: z.enum(["slow", "normal", "fast"]),
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
      });

      client.emit("tutor_message", {
        text: result.greeting.text,
        audio: result.greeting.audio,
        exercise: result.greeting.exercise,
      });
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

  @SubscribeMessage("audio")
  async handleAudio(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ) {
    const parsed = wsAudioMessageSchema.safeParse(data);
    if (!parsed.success) {
      client.emit("error", { message: "Invalid audio message" });
      return;
    }

    const session = await this.sessionService.get(client.id);
    if (!session) return;

    const userId = (client.data as SocketData).userId;

    try {
      client.emit("status", { state: "thinking" });

      const result = await this.lessonMaintainer.processUserAudio(
        session.lessonId,
        userId,
        parsed.data.audio,
        session.systemPrompt,
        session.history,
        session.voiceId,
        session.speechSpeed,
      );

      await this.sessionService.appendHistory(
        client.id,
        { role: "user", content: result.transcript },
        { role: "assistant", content: result.tutorText },
      );

      client.emit("transcript", { text: result.transcript });
      client.emit("tutor_message", {
        text: result.tutorText,
        audio: result.tutorAudio,
        exercise: result.exercise,
      });
    } catch {
      client.emit("error", { message: "Something went wrong, mate!" });
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
            exercise: result.exercise,
            messageId,
          });
        },
        onError: (error) => {
          this.abortControllers.delete(client.id);
          this.logger.error(`Streaming failed: ${error.message}`);
          client.emit("error", { message: "Something went wrong, mate!" });
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

  @SubscribeMessage("exercise_answer")
  async handleExerciseAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ) {
    const parsed = wsExerciseAnswerSchema.safeParse(data);
    if (!parsed.success) {
      client.emit("error", { message: "Invalid exercise answer" });
      return;
    }

    const session = await this.sessionService.get(client.id);
    if (!session) return;

    await this.sessionService.appendHistory(client.id, {
      role: "user",
      content: `[Exercise answer: ${parsed.data.answer}]`,
    });

    // Re-read session to get updated history
    const updatedSession = await this.sessionService.get(client.id);
    if (!updatedSession) return;

    const result = await this.lessonMaintainer.processUserAudio(
      updatedSession.lessonId,
      (client.data as SocketData).userId,
      "",
      updatedSession.systemPrompt,
      updatedSession.history,
      updatedSession.voiceId,
      updatedSession.speechSpeed,
    );

    await this.sessionService.appendHistory(client.id, {
      role: "assistant",
      content: result.tutorText,
    });

    client.emit("exercise_feedback", {
      text: result.tutorText,
      audio: result.tutorAudio,
    });
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
