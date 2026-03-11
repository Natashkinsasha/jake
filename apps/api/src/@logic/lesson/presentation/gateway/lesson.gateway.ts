import type { LlmMessage } from "@lib/provider/src";
import { Logger, UseGuards } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { WsAuthGuard } from "@shared/shared-ws/ws-auth.guard";
import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { type LessonMaintainer, toSpeechSpeed } from "../../application/maintainer/lesson.maintainer";
import type { LessonSessionService } from "../../application/service/lesson-session.service";
import type { VoicePrintService } from "../../application/service/voice-print.service";

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

const wsExerciseAnswerSchema = z.object({
  exerciseId: z.string().uuid(),
  answers: z
    .array(
      z.object({
        word: z.string().max(200),
        definition: z.string().max(500),
      }),
    )
    .max(20),
});

@WebSocketGateway({ namespace: "/ws/lesson", cors: true })
@UseGuards(WsAuthGuard)
export class LessonGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LessonGateway.name);
  private abortControllers = new Map<string, AbortController>();
  private sentChunksText = new Map<string, string>();
  private pendingUserText = new Map<string, string>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private lessonMaintainer: LessonMaintainer,
    private sessionService: LessonSessionService,
    private jwtService: JwtService,
    private voicePrintService: VoicePrintService,
  ) {}

  private getUserId(client: Socket): string {
    return (client.data as SocketData).userId;
  }

  async handleConnection(client: Socket) {
    // Guards don't run for handleConnection, authenticate manually
    const token = (client.handshake.auth as Record<string, unknown>)["token"] ?? client.handshake.query["token"];

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

    const userId = this.getUserId(client);

    try {
      // Check for existing session (reconnection)
      const existingSession = await this.sessionService.get(userId);
      if (existingSession) {
        client.emit("lesson_resumed", {
          lessonId: existingSession.lessonId,
          voiceId: existingSession.voiceId,
          speechSpeed: existingSession.speechSpeed,
          isOnboarding: existingSession.isOnboarding,
          startedAt: existingSession.startedAt,
          history: existingSession.history.map((m) => ({
            role: m.role,
            text: m.content,
          })),
        });
        return;
      }

      const result = await this.lessonMaintainer.startLesson(userId);

      await this.sessionService.save(userId, {
        lessonId: result.lessonId,
        systemPrompt: result.systemPrompt,
        voiceId: result.voiceId,
        speechSpeed: result.speechSpeed,
        history: [{ role: "assistant", content: result.greeting.text }],
        startedAt: Date.now(),
        isOnboarding: result.isOnboarding,
      });

      client.emit("lesson_started", {
        lessonId: result.lessonId,
        voiceId: result.voiceId,
        speechSpeed: result.speechSpeed,
        ttsModel: result.ttsModel,
        systemPrompt: result.systemPrompt,
        emotion: result.greeting.emotion,
        isOnboarding: result.isOnboarding,
      });

      client.emit("tutor_chunk", { chunkIndex: 0, text: result.greeting.text });
      client.emit("tutor_stream_end", { fullText: result.greeting.text });
      for (const h of result.greeting.vocabHighlights) {
        client.emit("vocab_highlight", h);
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to start lesson: ${error instanceof Error ? error.message : String(error)}`);
      client.emit("error", { message: "Failed to start lesson" });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.abortControllers.get(client.id)?.abort();
    this.abortControllers.delete(client.id);
    this.sentChunksText.delete(client.id);
    this.pendingUserText.delete(client.id);
  }

  @SubscribeMessage("text")
  async handleText(@ConnectedSocket() client: Socket, @MessageBody() data: unknown) {
    const parsed = wsTextMessageSchema.safeParse(data);
    if (!parsed.success) {
      client.emit("error", { message: "Invalid text message" });
      return;
    }

    const userId = this.getUserId(client);

    // Cancel any in-flight generation
    this.abortControllers.get(client.id)?.abort();
    const abortController = new AbortController();
    this.abortControllers.set(client.id, abortController);

    const messageId = parsed.data.messageId;

    this.sentChunksText.set(client.id, "");
    this.pendingUserText.set(client.id, parsed.data.text);

    client.emit("status", { state: "thinking" });

    await this.lessonMaintainer.processTextMessageStreaming(
      userId,
      parsed.data.text,
      {
        onChunk: (chunk) => {
          const current = this.sentChunksText.get(client.id) ?? "";
          const sep = current && !/^[,.\-!?;:'"]/.test(chunk.text) ? " " : "";
          this.sentChunksText.set(client.id, current + sep + chunk.text);
          client.emit("tutor_chunk", { ...chunk, messageId });
        },
        onEnd: (result) => {
          this.abortControllers.delete(client.id);
          this.sentChunksText.delete(client.id);
          this.pendingUserText.delete(client.id);
          client.emit("tutor_stream_end", {
            fullText: result.fullText,
            messageId,
          });
        },
        onError: (error) => {
          this.abortControllers.delete(client.id);
          this.sentChunksText.delete(client.id);
          this.pendingUserText.delete(client.id);
          this.logger.error(`Streaming failed: ${error.message}`);
          client.emit("error", { message: "Something went wrong!" });
        },
        onDiscard: (safetyText) => {
          this.abortControllers.delete(client.id);
          this.sentChunksText.delete(client.id);
          this.pendingUserText.delete(client.id);
          client.emit("tutor_stream_end", { discarded: true, messageId });
          client.emit("tutor_message", { text: safetyText });
        },
        onSpeedChange: (speed) => {
          client.emit("speed_updated", { speed });
        },
        onEmotion: (emotion) => {
          client.emit("tutor_emotion", { emotion, messageId });
        },
        onOnboardingComplete: (data) => {
          client.emit("onboarding_completed", data);
        },
        onVocabHighlight: (highlight) => {
          this.logger.log(`Emitting vocab_highlight to client: ${JSON.stringify(highlight)}`);
          client.emit("vocab_highlight", highlight);
        },
        onVocabReviewed: (word) => {
          this.logger.log(`Emitting vocab_reviewed to client: ${word}`);
          client.emit("vocab_reviewed", { word });
        },
        onExercise: (exercise) => {
          client.emit("exercise", exercise);
        },
      },
      { signal: abortController.signal },
    );
  }

  @SubscribeMessage("interrupt")
  async handleInterrupt(@ConnectedSocket() client: Socket) {
    const controller = this.abortControllers.get(client.id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(client.id);

      const partialText = this.sentChunksText.get(client.id);
      const userText = this.pendingUserText.get(client.id);
      this.sentChunksText.delete(client.id);
      this.pendingUserText.delete(client.id);

      const messages: LlmMessage[] = [];
      if (userText?.trim()) {
        messages.push({ role: "user", content: userText.trim() });
      }
      if (partialText?.trim()) {
        messages.push({ role: "assistant", content: `${partialText.trim()}...` });
      }
      if (messages.length > 0) {
        await this.sessionService.appendHistory(this.getUserId(client), ...messages);
      }

      this.logger.debug(`Interrupted streaming for ${client.id}`);
    }
  }

  @SubscribeMessage("set_speed")
  async handleSetSpeed(@ConnectedSocket() client: Socket, @MessageBody() data: unknown) {
    const parsed = wsSetSpeedSchema.safeParse(data);
    if (!parsed.success) {
      client.emit("error", { message: "Invalid speed value" });
      return;
    }

    const session = await this.sessionService.get(this.getUserId(client));
    if (!session) {
      return;
    }

    const speed = toSpeechSpeed(parsed.data.speed);
    await this.sessionService.updateSpeechSpeed(this.getUserId(client), speed);

    client.emit("speed_updated", { speed: parsed.data.speed });
  }

  @SubscribeMessage("voice_sample")
  async handleVoiceSample(@ConnectedSocket() client: Socket, @MessageBody() data: { audio: string }) {
    if (!data.audio) {
      return;
    }

    const socketData = client.data as SocketData;
    if (socketData.voiceSampleProcessed) {
      return;
    }
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
        await this.sessionService.setVoiceMismatch(this.getUserId(client), true);
        this.logger.log(`Voice mismatch detected for user ${userId}, similarity: ${result.similarity?.toFixed(3)}`);
      }
    } catch (error) {
      this.logger.error(`Voice sample processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  @SubscribeMessage("exercise_answer")
  async handleExerciseAnswer(@ConnectedSocket() client: Socket, @MessageBody() data: unknown) {
    const parsed = wsExerciseAnswerSchema.safeParse(data);
    if (!parsed.success) {
      client.emit("error", { message: "Invalid exercise answer" });
      return;
    }

    const userId = this.getUserId(client);
    const session = await this.sessionService.get(userId);
    if (!session?.activeExercise || session.activeExercise.id !== parsed.data.exerciseId) {
      client.emit("error", { message: "No active exercise" });
      return;
    }

    const { exercise } = session.activeExercise;
    const results = exercise.pairs.map((pair) => {
      const studentAnswer = parsed.data.answers.find((a) => a.word === pair.word);
      return {
        word: pair.word,
        correct: studentAnswer?.definition === pair.definition,
        correctDefinition: pair.definition,
      };
    });

    const correctCount = results.filter((r) => r.correct).length;
    const score = `${correctCount}/${results.length}`;

    client.emit("exercise_feedback", {
      exerciseId: parsed.data.exerciseId,
      results,
      score,
    });

    // Add result to Claude's history so tutor can comment
    const mistakes = results
      .filter((r) => !r.correct)
      .map((r) => {
        const studentDef = parsed.data.answers.find((a) => a.word === r.word)?.definition ?? "no answer";
        return `"${r.word}" -> student matched with "${studentDef}" (correct: "${r.correctDefinition}")`;
      });

    const historyEntry =
      mistakes.length > 0
        ? `[Exercise result: ${score} correct. Mistakes: ${mistakes.join("; ")}]`
        : `[Exercise result: ${score} correct. Perfect score!]`;

    await this.sessionService.appendHistory(userId, { role: "user", content: historyEntry });
    await this.sessionService.clearActiveExercise(userId);

    // Trigger tutor response to comment on the exercise result
    await this.streamToClient(client, userId, historyEntry);
  }

  private async streamToClient(client: Socket, userId: string, text: string) {
    const abortController = new AbortController();
    this.abortControllers.set(client.id, abortController);
    this.sentChunksText.set(client.id, "");

    await this.lessonMaintainer.processTextMessageStreaming(
      userId,
      text,
      {
        onChunk: (chunk) => {
          const current = this.sentChunksText.get(client.id) ?? "";
          const sep = current && !/^[,.\-!?;:'"]/.test(chunk.text) ? " " : "";
          this.sentChunksText.set(client.id, current + sep + chunk.text);
          client.emit("tutor_chunk", chunk);
        },
        onEnd: (result) => {
          this.abortControllers.delete(client.id);
          this.sentChunksText.delete(client.id);
          client.emit("tutor_stream_end", { fullText: result.fullText });
        },
        onError: (error) => {
          this.abortControllers.delete(client.id);
          this.sentChunksText.delete(client.id);
          this.logger.error(`Streaming failed: ${error.message}`);
        },
        onSpeedChange: (speed) => {
          client.emit("speed_updated", { speed });
        },
        onEmotion: (emotion) => {
          client.emit("tutor_emotion", { emotion });
        },
        onVocabHighlight: (highlight) => {
          client.emit("vocab_highlight", highlight);
        },
        onVocabReviewed: (word) => {
          client.emit("vocab_reviewed", { word });
        },
        onExercise: (exercise) => {
          client.emit("exercise", exercise);
        },
      },
      { signal: abortController.signal },
    );
  }

  @SubscribeMessage("end_lesson")
  async handleEndLesson(@ConnectedSocket() client: Socket) {
    const session = await this.sessionService.get(this.getUserId(client));
    if (!session) {
      return;
    }

    await this.lessonMaintainer.endLesson(session.lessonId, session.history);
    await this.sessionService.delete(this.getUserId(client));

    client.emit("lesson_ended", { lessonId: session.lessonId });
    client.disconnect();
  }
}
