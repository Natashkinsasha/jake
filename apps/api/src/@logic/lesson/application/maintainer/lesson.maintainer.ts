import { Injectable, Logger } from "@nestjs/common";
import { LessonRepository } from "../../infrastructure/repository/lesson.repository";
import { LessonMessageRepository } from "../../infrastructure/repository/lesson-message.repository";
import { LessonContextService } from "../service/lesson-context.service";
import { LessonResponseService } from "../service/lesson-response.service";
import { StreamingPipelineService } from "../service/streaming-pipeline.service";
import type { StreamCallbacks, StreamChunk } from "../service/streaming-pipeline.service";
import { TtsProvider } from "../../../../@lib/provider/src";
import type { LlmMessage } from "../../../../@lib/provider/src";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { buildFullSystemPrompt } from "../service/prompt-builder";
import { QUEUE_NAMES } from "../../../../@shared/shared-job/queue-names";
import { ModerationService, SAFETY_RESPONSE } from "../../../llm/src/moderation/moderation.service";
import { LessonSessionService } from "../service/lesson-session.service";

export function toSpeechSpeed(pref: string): number {
  switch (pref) {
    case "slow": return 0.85;
    case "fast": return 1.2;
    default: return 1.0;
  }
}

const GREETING_PROMPTS = [
  "Greet the student casually, like a mate you haven't seen in a bit. Keep it to one short sentence.",
  "Say hi with a quick question about their day. One sentence max.",
  "Start with a fun, light comment and ask what they want to chat about today. Keep it super short.",
  "Give a chill Aussie greeting and ask how they're going. One sentence.",
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
    private tts: TtsProvider,
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

    let greetingAudio = "";
    try {
      greetingAudio = await this.tts.synthesize(
        greeting.text,
        context.tutorVoiceId,
        speechSpeed,
      );
    } catch (error) {
      this.logger.warn(`TTS failed for greeting, sending text only: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      lessonId: lesson.id,
      systemPrompt,
      voiceId: context.tutorVoiceId,
      speechSpeed,
      greeting: { text: greeting.text, audio: greetingAudio, exercise: greeting.exercise },
    };
  }

  async processExerciseAnswer(
    lessonId: string,
    userId: string,
    systemPrompt: string,
    history: LlmMessage[],
    voiceId: string,
    speechSpeed?: number,
  ) {
    const response = await this.responseService.generate(systemPrompt, history);

    let audio = "";
    try {
      audio = await this.tts.synthesize(response.text, voiceId, speechSpeed);
    } catch (error) {
      this.logger.warn(`TTS failed for exercise feedback: ${error instanceof Error ? error.message : String(error)}`);
    }

    await this.messageRepository.create({ lessonId, role: "tutor", content: response.text });

    await this.factQueue.add("extract", {
      userId,
      lessonId,
      userMessage: history[history.length - 1]?.content ?? "",
      history,
    });

    return { tutorText: response.text, tutorAudio: audio };
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
      await this.emitSafetyResponse(session.voiceId, session.speechSpeed, callbacks);
      return;
    }

    const updatedHistory: LlmMessage[] = [
      ...session.history,
      { role: "user", content: text },
    ];

    // Layer 2: LLM moderation runs in parallel with streaming.
    // Haiku (~200ms) typically resolves before Sonnet's first chunk (~500ms+).
    const gate = this.createModerationGate(userId, session.lessonId, text, callbacks);

    await this.streamingPipeline.stream(
      session.systemPrompt,
      updatedHistory,
      session.voiceId,
      {
        onChunk: (chunk) => { gate.handleChunk(chunk); },
        onEnd: (result) => {
          void (async () => {
            await gate.waitForVerdict();

            if (!gate.isSafe) {
              await this.emitSafetyResponse(session.voiceId, session.speechSpeed, callbacks);
              return;
            }

            await this.messageRepository.create({ lessonId: session.lessonId, role: "user", content: text });
            await this.messageRepository.create({ lessonId: session.lessonId, role: "tutor", content: result.fullText });

            await this.factQueue.add("extract", {
              userId,
              lessonId: session.lessonId,
              userMessage: text,
              history: updatedHistory,
            });

            await this.sessionService.appendHistory(
              socketId,
              { role: "user", content: text },
              { role: "assistant", content: result.fullText },
            );

            callbacks.onEnd(result);
          })();
        },
        onError: (error) => {
          callbacks.onError(error);
        },
      },
      { speechSpeed: session.speechSpeed, signal: options?.signal },
    );
  }

  private createModerationGate(
    userId: string,
    lessonId: string,
    text: string,
    callbacks: StreamCallbacks,
  ) {
    let resolved = false;
    let safe = true;
    const pending: StreamChunk[] = [];

    const promise = this.moderationService
      .llmCheck(text, { userId, lessonId })
      .then((result) => {
        resolved = true;
        safe = result.isSafe;

        if (!result.isSafe) {
          this.logger.warn(`LLM flagged input from ${userId}: reason=${result.reason}`);
        } else {
          for (const chunk of pending) {
            callbacks.onChunk(chunk);
          }
          pending.length = 0;
        }
      })
      .catch((err: unknown) => {
        this.logger.error(`LLM moderation failed, allowing message: ${err instanceof Error ? err.message : String(err)}`);
        resolved = true;
        safe = true;
        for (const chunk of pending) {
          callbacks.onChunk(chunk);
        }
        pending.length = 0;
      });

    return {
      handleChunk(chunk: StreamChunk) {
        if (!resolved) {
          pending.push(chunk);
        } else if (safe) {
          callbacks.onChunk(chunk);
        }
      },
      waitForVerdict: () => promise,
      get isSafe() { return safe; },
    };
  }

  private async emitSafetyResponse(
    voiceId: string,
    speechSpeed: number | undefined,
    callbacks: StreamCallbacks,
  ) {
    let audio = "";
    try {
      audio = await this.tts.synthesize(SAFETY_RESPONSE, voiceId, speechSpeed);
    } catch (error) {
      this.logger.warn(`TTS failed for safety response: ${error instanceof Error ? error.message : String(error)}`);
    }

    callbacks.onChunk({ chunkIndex: 0, text: SAFETY_RESPONSE, audio });
    callbacks.onEnd({ fullText: SAFETY_RESPONSE, exercise: null, tokens: { text: "", inputTokens: 0, outputTokens: 0 } });
  }

  async endLesson(lessonId: string, history: LlmMessage[]) {
    await this.lessonRepository.complete(lessonId, {});

    await this.postLessonQueue.add("process", {
      lessonId,
      conversationHistory: history,
    });
  }
}
