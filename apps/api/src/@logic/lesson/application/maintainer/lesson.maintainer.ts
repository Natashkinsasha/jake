import { Injectable, Logger } from "@nestjs/common";
import { LessonRepository } from "../../infrastructure/repository/lesson.repository";
import { LessonMessageRepository } from "../../infrastructure/repository/lesson-message.repository";
import { LessonContextService } from "../service/lesson-context.service";
import { LessonResponseService } from "../service/lesson-response.service";
import { StreamingPipelineService } from "../service/streaming-pipeline.service";
import type { StreamCallbacks } from "../service/streaming-pipeline.service";
import type { LlmMessage } from "../../../../@lib/provider/src";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { buildFullSystemPrompt } from "../service/prompt-builder";
import { QUEUE_NAMES } from "../../../../@shared/shared-job/queue-names";
import { ModerationService, SAFETY_RESPONSE } from "../../../llm/src/moderation/moderation.service";
import { LessonSessionService } from "../service/lesson-session.service";

const SET_SPEED_RE = /<set_speed>(very_slow|slow|natural|fast|very_fast)<\/set_speed>/g;

function stripSpeedTags(text: string): { cleanText: string; speed: string | null } {
  let speed: string | null = null;
  const cleanText = text.replace(SET_SPEED_RE, (_, s: string) => { speed = s; return ""; }).trim();
  return { cleanText, speed };
}

export function toSpeechSpeed(pref: string): number {
  switch (pref) {
    case "very_slow": return 0.7;
    case "slow": return 0.85;
    case "fast": return 1.15;
    case "very_fast": return 1.3;
    default: return 1.0;
  }
}

const GREETING_PROMPTS = [
  "Greet the student casually, like a friend you haven't seen in a bit. Keep it to one short sentence.",
  "Say hi with a quick question about their day. One sentence max.",
  "Start with a fun, light comment and ask what they want to chat about today. Keep it super short.",
  "Give a friendly greeting and ask how they're doing. One sentence.",
  "Welcome them back with energy. Maybe reference something fun. Keep it brief — one sentence.",
];

function pickGreetingPrompt(): string {
  return GREETING_PROMPTS[Math.floor(Math.random() * GREETING_PROMPTS.length)] ?? GREETING_PROMPTS[0] ?? "";
}

@Injectable()
export class LessonMaintainer {
  private readonly logger = new Logger(LessonMaintainer.name);

  constructor(
    private lessonRepository: LessonRepository,
    private messageRepository: LessonMessageRepository,
    private contextService: LessonContextService,
    private responseService: LessonResponseService,
    private streamingPipeline: StreamingPipelineService,
    private sessionService: LessonSessionService,
    private moderationService: ModerationService,
    @InjectQueue(QUEUE_NAMES.POST_LESSON) private postLessonQueue: Queue,
    @InjectQueue(QUEUE_NAMES.FACT_EXTRACTION) private factQueue: Queue,
  ) {}

  async getLesson(lessonId: string) {
    const lesson = await this.lessonRepository.findById(lessonId);
    if (!lesson) return null;
    const messages = await this.messageRepository.findByLesson(lessonId);
    return {
      id: lesson.id,
      status: lesson.status,
      topic: lesson.topics != null && lesson.topics.length > 0 ? lesson.topics.join(", ") : null,
      createdAt: lesson.startedAt,
      duration: lesson.durationMinutes,
      summary: lesson.summary,
      lessonNumber: lesson.lessonNumber,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
    };
  }

  async listLessons(userId: string) {
    const lessons = await this.lessonRepository.findRecentByUser(userId);
    return lessons.map((l) => ({
      id: l.id,
      status: l.status,
      topic: l.topics != null && l.topics.length > 0 ? l.topics.join(", ") : null,
      createdAt: l.startedAt,
      duration: l.durationMinutes,
      summary: l.summary,
      lessonNumber: l.lessonNumber,
    }));
  }

  async startLesson(userId: string) {
    const context = await this.contextService.build(userId);

    const systemPrompt = buildFullSystemPrompt(context);

    const greeting = await this.responseService.generate(systemPrompt, [
      { role: "user", content: pickGreetingPrompt() },
    ], "lesson.greeting");

    const lesson = await this.lessonRepository.createWithGreeting(
      {
        userId,
        tutorId: context.tutorId,
        lessonNumber: context.lessonNumber,
      },
      greeting.text,
    );

    const speechSpeed = toSpeechSpeed(context.preferences.speakingSpeed);

    return {
      lessonId: lesson.id,
      systemPrompt,
      voiceId: context.tutorVoiceId,
      speechSpeed,
      greeting: { text: greeting.text },
    };
  }

  async processTextMessageStreaming(
    socketId: string,
    userId: string,
    text: string,
    callbacks: StreamCallbacks,
    options?: { signal?: AbortSignal },
  ) {
    const session = await this.sessionService.get(socketId);
    if (!session) return;

    // Layer 1: Regex pre-filter (instant, <1ms)
    const quickResult = this.moderationService.quickCheck(text);
    if (!quickResult.isSafe) {
      this.logger.warn(`Regex flagged input from ${userId}: reason="${quickResult.reason}"`);
      this.emitSafetyResponse(callbacks);
      return;
    }

    const updatedHistory: LlmMessage[] = [
      ...session.history,
      { role: "user", content: text },
    ];

    // Layer 2: LLM moderation runs in parallel with streaming.
    // Optimistic strategy: chunks are sent to client immediately (no buffering).
    // If moderation flags the input, we discard the stream and send a safety response.
    const moderationPromise = this.moderationService
      .llmCheck(text, { userId, lessonId: session.lessonId })
      .catch((err: unknown) => {
        this.logger.error(`LLM moderation failed, allowing message: ${err instanceof Error ? err.message : String(err)}`);
        return { isSafe: true as const, reason: null };
      });

    await this.streamingPipeline.stream(
      session.systemPrompt,
      updatedHistory,
      {
        onChunk: (chunk) => {
          const { cleanText } = stripSpeedTags(chunk.text);
          if (cleanText) {
            callbacks.onChunk({ ...chunk, text: cleanText });
          }
        },
        onEnd: (result) => {
          void (async () => {
            const modResult = await moderationPromise;

            if (options?.signal?.aborted) return;

            if (!modResult.isSafe) {
              this.logger.warn(`LLM flagged input from ${userId}: reason=${modResult.reason}`);
              callbacks.onDiscard?.(SAFETY_RESPONSE);
              return;
            }

            const { cleanText, speed } = stripSpeedTags(result.fullText);

            if (speed) {
              const numericSpeed = toSpeechSpeed(speed);
              await this.sessionService.updateSpeechSpeed(socketId, numericSpeed);
              callbacks.onSpeedChange?.(speed);
            }

            await this.messageRepository.create({ lessonId: session.lessonId, role: "user", content: text });
            await this.messageRepository.create({ lessonId: session.lessonId, role: "tutor", content: cleanText });

            await this.factQueue.add("extract", {
              userId,
              lessonId: session.lessonId,
              userMessage: text,
              history: updatedHistory,
            });

            await this.sessionService.appendHistory(
              socketId,
              { role: "user", content: text },
              { role: "assistant", content: cleanText },
            );

            callbacks.onEnd({ ...result, fullText: cleanText });
          })();
        },
        onError: (error) => {
          callbacks.onError(error);
        },
      },
      { signal: options?.signal },
    );
  }

  private emitSafetyResponse(callbacks: StreamCallbacks) {
    callbacks.onChunk({ chunkIndex: 0, text: SAFETY_RESPONSE });
    callbacks.onEnd({ fullText: SAFETY_RESPONSE, tokens: { text: "", inputTokens: 0, outputTokens: 0 } });
  }

  async endLesson(lessonId: string, history: LlmMessage[]) {
    await this.lessonRepository.complete(lessonId, {});

    await this.postLessonQueue.add("process", {
      lessonId,
      conversationHistory: history,
    });
  }
}
