import { Logger, UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { EnvService } from "@shared/shared-config/env.service";
import { WsAuthGuard } from "@shared/shared-ws/ws-auth.guard";
import { type Server, Socket } from "socket.io";
import { z } from "zod";
import { LessonMaintainer, toSpeechSpeed } from "../../application/maintainer/lesson.maintainer";
import { LessonSessionService } from "../../application/service/lesson-session.service";
import { toTranscript } from "../../application/service/tutor-reply";
import { VoicePrintService } from "../../application/service/voice-print.service";

interface SocketData {
  userId: string;
  voiceSampleProcessed?: boolean;
}

interface ActiveTurn {
  clientId: string;
  controller: AbortController;
  // Resolves once the maintainer has stored the turn, however it ended
  settled: Promise<void>;
}

const MAX_VOICE_SAMPLE_BYTES = 512 * 1024; // 512KB

const noop = () => undefined;

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
  // One turn per student, whichever socket it came from: they all share one history
  private turns = new Map<string, ActiveTurn>();
  // Open sockets per student; a lesson is scheduled to finish only once the last one closes
  private connections = new Map<string, Set<string>>();
  // Lessons open one at a time per student, so a second socket resumes the lesson the first started
  private opening = new Map<string, Promise<void>>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private lessonMaintainer: LessonMaintainer,
    private sessionService: LessonSessionService,
    private jwtService: JwtService,
    private voicePrintService: VoicePrintService,
    private env: EnvService,
  ) {}

  private getUserId(client: Socket): string {
    return (client.data as SocketData).userId;
  }

  async handleConnection(client: Socket) {
    // Guards don't run for handleConnection, authenticate manually
    const token = (client.handshake.auth as Record<string, unknown>)["token"] ?? client.handshake.query["token"];

    if (token == null) {
      client.emit("error", { message: "No auth token", fatal: true });
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token as string);
      (client.data as SocketData) = { userId: payload.sub };
    } catch {
      client.emit("error", { message: "Invalid token", fatal: true });
      client.disconnect();
      return;
    }

    if (client.disconnected) {
      return; // closed during the token check, before handleDisconnect could see a user
    }
    const userId = this.getUserId(client);
    this.trackConnection(userId, client.id);

    const previous = this.opening.get(userId) ?? Promise.resolve();
    const opening = previous.then(() => this.openLesson(client, userId));
    const settled = opening.then(noop, noop);
    this.opening.set(userId, settled);
    try {
      await opening;
    } finally {
      if (this.opening.get(userId) === settled) {
        this.opening.delete(userId);
      }
    }
    // The socket may have closed while the lesson was starting, before there was a session to finish
    if (client.disconnected && !this.connections.has(userId)) {
      await this.scheduleFinalize(userId);
    }
  }

  // Resumes the student's lesson, or starts one when there is none.
  private async openLesson(client: Socket, userId: string) {
    try {
      // Check for existing session (reconnection)
      const existingSession = await this.sessionService.get(userId);
      if (existingSession) {
        await this.sessionService.markSeen(userId);
        // The job also checks lastSeenAt, so a failed removal only costs a no-op run later
        await this.lessonMaintainer.cancelFinalize(existingSession.lessonId).catch((error: unknown) => {
          this.logger.warn(`Failed to cancel lesson finalization: ${String(error)}`);
        });
        client.emit("lesson_resumed", {
          lessonId: existingSession.lessonId,
          voiceId: existingSession.voiceId,
          speechSpeed: existingSession.speechSpeed,
          isOnboarding: existingSession.isOnboarding,
          startedAt: existingSession.startedAt,
          history: toTranscript(existingSession.history).map((m) => ({
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
        history: [{ role: "assistant", content: result.greeting.rawText }],
        startedAt: Date.now(),
        lastSeenAt: Date.now(),
        isOnboarding: result.isOnboarding,
      });

      client.emit("lesson_started", {
        lessonId: result.lessonId,
        voiceId: result.voiceId,
        speechSpeed: result.speechSpeed,
        ttsModel: result.ttsModel,
        // For the debug panel only: the prompt carries the student's facts and the prompt rules
        ...(this.env.get("NODE_ENV") === "production" ? {} : { systemPrompt: result.systemPrompt }),
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
      client.emit("error", { message: "Failed to start lesson", fatal: true });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.getUserId(client);
    if (!userId) {
      return; // never authenticated
    }
    // A reconnected socket may already run the next turn; only stop this socket's own
    if (this.turns.get(userId)?.clientId === client.id) {
      await this.abortTurn(client);
    }
    if (this.untrackConnection(userId, client.id) === 0) {
      await this.scheduleFinalize(userId);
    }
  }

  private async scheduleFinalize(userId: string) {
    try {
      await this.lessonMaintainer.scheduleFinalize(userId);
    } catch (error) {
      this.logger.error(
        `Failed to schedule lesson finalization: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private trackConnection(userId: string, clientId: string) {
    const sockets = this.connections.get(userId) ?? new Set<string>();
    sockets.add(clientId);
    this.connections.set(userId, sockets);
  }

  // Returns how many sockets the student still has open.
  private untrackConnection(userId: string, clientId: string): number {
    const sockets = this.connections.get(userId);
    sockets?.delete(clientId);
    if (!sockets || sockets.size === 0) {
      this.connections.delete(userId);
      return 0;
    }
    return sockets.size;
  }

  @SubscribeMessage("text")
  async handleText(@ConnectedSocket() client: Socket, @MessageBody() data: unknown) {
    const parsed = wsTextMessageSchema.safeParse(data);
    if (!parsed.success) {
      client.emit("error", { message: "Invalid text message", turn: true });
      return;
    }

    await this.runTurn(client, parsed.data.text, parsed.data.messageId);
  }

  @SubscribeMessage("interrupt")
  async handleInterrupt(@ConnectedSocket() client: Socket) {
    if (await this.abortTurn(client)) {
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

    await this.sessionService.clearActiveExercise(userId);

    // The result goes to the tutor as the next user message; the turn records it in history
    await this.runTurn(client, historyEntry);
  }

  // Streams the tutor's reply to `text`. A reply still in flight is stopped and stored first,
  // so this request extends the history the student actually heard.
  private async runTurn(client: Socket, text: string, messageId?: string) {
    const userId = this.getUserId(client);
    while (this.turns.has(userId)) {
      await this.abortTurn(client);
    }

    const controller = new AbortController();
    client.emit("status", { state: "thinking" });

    const settled = this.lessonMaintainer.processTextMessageStreaming(
      userId,
      text,
      {
        onChunk: (chunk) => {
          client.emit("tutor_chunk", { ...chunk, messageId });
        },
        onEnd: (result) => {
          client.emit("tutor_stream_end", {
            fullText: result.fullText,
            messageId,
          });
        },
        onError: (error) => {
          this.logger.error(`Streaming failed: ${error.message}`);
          // Only this reply failed: the client ends it and the lesson goes on
          client.emit("error", { message: "Something went wrong!", turn: true, messageId });
        },
        onDiscard: (safetyText) => {
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
      { signal: controller.signal },
    );
    const turn: ActiveTurn = { clientId: client.id, controller, settled: settled.then(noop, noop) };
    this.turns.set(userId, turn);

    try {
      await settled;
    } finally {
      this.forgetTurn(userId, turn);
    }
  }

  // Stops the reply in flight and waits until the maintainer has stored that turn, applying the
  // moderation verdict. Returns false when nothing was in flight.
  private async abortTurn(client: Socket): Promise<boolean> {
    const userId = this.getUserId(client);
    const turn = this.turns.get(userId);
    if (!turn) {
      return false;
    }
    turn.controller.abort();
    await turn.settled;
    this.forgetTurn(userId, turn);
    return true;
  }

  private forgetTurn(userId: string, turn: ActiveTurn) {
    if (this.turns.get(userId) === turn) {
      this.turns.delete(userId);
    }
  }

  @SubscribeMessage("end_lesson")
  async handleEndLesson(@ConnectedSocket() client: Socket) {
    // The reply in flight belongs to the lesson: stop it and store it before the summary job
    await this.abortTurn(client);
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
