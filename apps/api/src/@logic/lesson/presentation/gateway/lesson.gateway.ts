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
import { LessonMaintainer } from "../../application/maintainer/lesson.maintainer";
import { LessonSessionService } from "../../application/service/lesson-session.service";
import { wsAudioMessageSchema } from "../dto/ws/ws-audio-message";
import { wsExerciseAnswerSchema } from "../dto/ws/ws-exercise-answer";

const wsTextMessageSchema = z.object({
  text: z.string().min(1),
});

@WebSocketGateway({ namespace: "/ws/lesson", cors: true })
@UseGuards(WsAuthGuard)
export class LessonGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LessonGateway.name);

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
      client.handshake?.auth?.token ||
      client.handshake?.query?.token;

    if (!token) {
      client.emit("error", { message: "No auth token" });
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token as string);
      client.data = { userId: payload.sub };
    } catch {
      client.emit("error", { message: "Invalid token" });
      client.disconnect();
      return;
    }

    const userId = client.data.userId;

    try {
      const result = await this.lessonMaintainer.startLesson(userId);

      await this.sessionService.save(client.id, {
        lessonId: result.lessonId,
        systemPrompt: result.systemPrompt,
        voiceId: result.voiceId,
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
    } catch (error) {
      this.logger.error("Failed to start lesson:", error);
      client.emit("error", { message: "Failed to start lesson" });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
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

    const userId = client.data.userId;

    try {
      client.emit("status", { state: "thinking" });

      const result = await this.lessonMaintainer.processUserAudio(
        session.lessonId,
        userId,
        parsed.data.audio,
        session.systemPrompt,
        session.history,
        session.voiceId,
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
    } catch (error) {
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

    const session = await this.sessionService.get(client.id);
    if (!session) return;

    try {
      client.emit("status", { state: "thinking" });

      const result = await this.lessonMaintainer.processTextMessage(
        session.lessonId,
        client.data.userId,
        parsed.data.text,
        session.systemPrompt,
        session.history,
        session.voiceId,
      );

      await this.sessionService.appendHistory(
        client.id,
        { role: "user", content: parsed.data.text },
        { role: "assistant", content: result.tutorText },
      );

      client.emit("tutor_message", {
        text: result.tutorText,
        audio: result.tutorAudio,
        exercise: result.exercise,
      });
    } catch (error) {
      client.emit("error", { message: "Something went wrong, mate!" });
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
      client.data.userId,
      "",
      updatedSession.systemPrompt,
      updatedSession.history,
      updatedSession.voiceId,
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
