import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import type { LlmMessage } from "@lib/provider/src";
import { QUEUE_NAMES } from "@shared/shared-job/queue-names";
import { LessonRepository } from "../../infrastructure/repository/lesson.repository";
import { LessonMessageRepository } from "../../infrastructure/repository/lesson-message.repository";
import { LessonContextService } from "../service/lesson-context.service";
import { LessonResponseService } from "../service/lesson-response.service";
import { StreamingPipelineService } from "../service/streaming-pipeline.service";
import type { StreamCallbacks } from "../service/streaming-pipeline.service";
import { buildFullSystemPrompt } from "../service/prompt-builder";
import { ModerationService, SAFETY_RESPONSE } from "../../../llm/src/moderation/moderation.service";
import { LessonSessionService } from "../service/lesson-session.service";
import { parseEmotion } from "../service/emotion";
import { extractVocabTags, VocabTagBuffer } from "../service/vocab-tags";
import { VocabularyContract } from "../../../vocabulary/contract/vocabulary.contract";

const SET_SPEED_RE = /<set_speed>(very_slow|slow|natural|fast|very_fast)<\/set_speed>/g;

function stripSpeedTags(text: string): { cleanText: string; speed: string | null } {
  let speed: string | null = null;
  const cleanText = text.replaceAll(SET_SPEED_RE, (_, s: string) => { speed = s; return ""; }).trim();
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
    private vocabularyContract: VocabularyContract,
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

  async listLessons(userId: string, offset = 0, limit = 10) {
    const lessons = await this.lessonRepository.findRecentByUser(userId, limit, offset);
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

    const { cleanText: greetingText, speed: greetingSpeed } = stripSpeedTags(greeting.text);
    const { emotion: greetingEmotion, text: greetingCleanText } = parseEmotion(greetingText);

    const lesson = await this.lessonRepository.createWithGreeting(
      {
        userId,
        lessonNumber: context.lessonNumber,
      },
      greetingCleanText,
    );
    const speechSpeed = toSpeechSpeed(greetingSpeed ?? context.preferences.speakingSpeed);

    return {
      lessonId: lesson.id,
      systemPrompt,
      voiceId: context.tutorVoiceId,
      speechSpeed,
      ttsModel: context.preferences.ttsModel,
      greeting: { text: greetingCleanText, emotion: greetingEmotion },
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

    // Inject voice mismatch hint into system prompt (one-time)
    let systemPrompt = session.systemPrompt;
    if (session.voiceMismatch) {
      systemPrompt += "\n\n=== VOICE OBSERVATION ===\nThe student's voice sounds noticeably different from their usual voice today. They might be sick, tired, or feeling off. You can gently and naturally ask if they're feeling okay — don't make a big deal of it, just show you noticed. One brief mention is enough.";
      await this.sessionService.setVoiceMismatch(socketId, false);
    }

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

    const vocabBuffer = new VocabTagBuffer();

    await this.streamingPipeline.stream(
      systemPrompt,
      updatedHistory,
      {
        onChunk: (chunk) => {
          this.logger.debug(`RAW chunk: "${chunk.text}"`);
          const { cleanText: noSpeed } = stripSpeedTags(chunk.text);
          const { text: noEmotion } = parseEmotion(noSpeed);
          const { cleanText, highlights, reviewedWords } = vocabBuffer.push(noEmotion);

          if (highlights.length > 0) {
            this.logger.log(`Vocab highlights extracted: ${highlights.map(h => h.word).join(", ")}`);
            for (const h of highlights) {
              void this.vocabularyContract.upsert({
                userId,
                word: h.word,
                translation: h.translation,
                topic: h.topic,
                lessonId: session.lessonId,
              }).catch((err: unknown) => {
                this.logger.error(`Failed to save vocab "${h.word}": ${err instanceof Error ? err.message : String(err)}`);
              });
            }
          }
          for (const h of highlights) callbacks.onVocabHighlight?.(h);
          for (const w of reviewedWords) callbacks.onVocabReviewed?.(w);

          if (cleanText) {
            callbacks.onChunk({ ...chunk, text: cleanText });
          }
        },
        onEnd: (result) => {
          // Flush any remaining buffered vocab tags
          const remaining = vocabBuffer.flush();
          if (remaining.highlights.length > 0) {
            this.logger.log(`Vocab flush highlights: ${remaining.highlights.map(h => h.word).join(", ")}`);
            for (const h of remaining.highlights) {
              void this.vocabularyContract.upsert({
                userId,
                word: h.word,
                translation: h.translation,
                topic: h.topic,
                lessonId: session.lessonId,
              }).catch((err: unknown) => {
                this.logger.error(`Failed to save vocab "${h.word}": ${err instanceof Error ? err.message : String(err)}`);
              });
            }
          }
          for (const h of remaining.highlights) callbacks.onVocabHighlight?.(h);
          for (const w of remaining.reviewedWords) callbacks.onVocabReviewed?.(w);
          if (remaining.cleanText) {
            callbacks.onChunk({ chunkIndex: -1, text: remaining.cleanText });
          }

          void (async () => {
            const modResult = await moderationPromise;

            if (options?.signal?.aborted) return;

            if (!modResult.isSafe) {
              this.logger.warn(`LLM flagged input from ${userId}: reason=${modResult.reason}`);
              callbacks.onDiscard?.(SAFETY_RESPONSE);
              return;
            }

            this.logger.log(`RAW fullText: "${result.fullText}"`);
            const { cleanText: textWithoutSpeed, speed } = stripSpeedTags(result.fullText);
            const { text: textWithoutEmotion } = parseEmotion(textWithoutSpeed);
            const { cleanText, highlights: endHighlights } = extractVocabTags(textWithoutEmotion);
            if (endHighlights.length > 0) {
              this.logger.log(`Vocab from fullText: ${endHighlights.map(h => h.word).join(", ")}`);
            }

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
        onEmotion: (emotion) => {
          callbacks.onEmotion?.(emotion);
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
