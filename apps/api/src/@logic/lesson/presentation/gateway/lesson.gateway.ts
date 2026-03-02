import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { UseGuards } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { WsAuthGuard } from "../../../../@shared/shared-ws/ws-auth.guard";
import { LessonMaintainer } from "../../application/maintainer/lesson.maintainer";
import { LlmMessage } from "../../../../@lib/llm/src/llm.service";

interface LessonSession {
  lessonId: string;
  systemPrompt: string;
  voiceId: string;
  history: LlmMessage[];
}

@WebSocketGateway({ namespace: "/ws/lesson", cors: true })
@UseGuards(WsAuthGuard)
export class LessonGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private sessions = new Map<string, LessonSession>();

  constructor(private lessonMaintainer: LessonMaintainer) {}

  async handleConnection(client: Socket) {
    const userId = client.data.userId;
    if (!userId) {
      client.disconnect();
      return;
    }

    try {
      const result = await this.lessonMaintainer.startLesson(userId);

      const session: LessonSession = {
        lessonId: result.lessonId,
        systemPrompt: result.systemPrompt,
        voiceId: result.voiceId,
        history: [{ role: "assistant", content: result.greeting.text }],
      };
      this.sessions.set(client.id, session);

      client.emit("lesson_started", {
        lessonId: result.lessonId,
      });

      client.emit("tutor_message", {
        text: result.greeting.text,
        audio: result.greeting.audio,
        exercise: result.greeting.exercise,
      });
    } catch (error) {
      client.emit("error", { message: "Failed to start lesson" });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const session = this.sessions.get(client.id);
    if (session) {
      await this.lessonMaintainer.endLesson(session.lessonId, session.history);
      this.sessions.delete(client.id);
    }
  }

  @SubscribeMessage("audio")
  async handleAudio(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { audio: string },
  ) {
    const session = this.sessions.get(client.id);
    if (!session) return;

    const userId = client.data.userId;

    try {
      client.emit("status", { state: "thinking" });

      const result = await this.lessonMaintainer.processUserAudio(
        session.lessonId,
        userId,
        data.audio,
        session.systemPrompt,
        session.history,
        session.voiceId,
      );

      session.history.push(
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
    @MessageBody() data: { text: string },
  ) {
    const session = this.sessions.get(client.id);
    if (!session) return;

    try {
      client.emit("status", { state: "thinking" });

      const result = await this.lessonMaintainer.processTextMessage(
        session.lessonId,
        client.data.userId,
        data.text,
        session.systemPrompt,
        session.history,
        session.voiceId,
      );

      session.history.push(
        { role: "user", content: data.text },
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
    @MessageBody() data: { exerciseId: string; answer: string },
  ) {
    const session = this.sessions.get(client.id);
    if (!session) return;

    session.history.push({
      role: "user",
      content: `[Exercise answer: ${data.answer}]`,
    });

    const result = await this.lessonMaintainer.processUserAudio(
      session.lessonId,
      client.data.userId,
      "",
      session.systemPrompt,
      session.history,
      session.voiceId,
    );

    session.history.push({ role: "assistant", content: result.tutorText });

    client.emit("exercise_feedback", {
      text: result.tutorText,
      audio: result.tutorAudio,
    });
  }

  @SubscribeMessage("end_lesson")
  async handleEndLesson(@ConnectedSocket() client: Socket) {
    const session = this.sessions.get(client.id);
    if (!session) return;

    await this.lessonMaintainer.endLesson(session.lessonId, session.history);
    this.sessions.delete(client.id);

    client.emit("lesson_ended", { lessonId: session.lessonId });
    client.disconnect();
  }
}
