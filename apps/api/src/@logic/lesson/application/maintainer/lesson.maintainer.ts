import { randomUUID } from "node:crypto";
import type { LlmMessage, LlmResponse } from "@lib/provider/src";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { QUEUE_NAMES } from "@shared/shared-job/queue-names";
import type { Queue } from "bullmq";
import { AuthContract } from "../../../auth/contract/auth.contract";
import {
  type ModerationCheckResult,
  ModerationService,
  SAFETY_RESPONSE,
} from "../../../llm/src/moderation/moderation.service";
import { LessonRepository } from "../../infrastructure/repository/lesson.repository";
import { LessonMessageRepository } from "../../infrastructure/repository/lesson-message.repository";
import { parseEmotion } from "../service/emotion";
import { ExerciseTagBuffer, type ParsedExercise } from "../service/exercise-tags";
import { LessonContextService } from "../service/lesson-context.service";
import { LessonResponseService } from "../service/lesson-response.service";
import { type LessonSession, LessonSessionService } from "../service/lesson-session.service";
import { buildFullSystemPrompt } from "../service/prompt-builder";
import {
  type StreamCallbacks,
  StreamingPipelineService,
  type StreamResult,
} from "../service/streaming-pipeline.service";
import {
  BLOCKED_MESSAGE,
  parseTutorReply,
  stripOnboardingTags,
  stripSpeedTags,
  toTranscript,
} from "../service/tutor-reply";
import { UnknownTagBuffer } from "../service/unknown-tags";
import { VocabTagBuffer } from "../service/vocab-tags";

export function toSpeechSpeed(pref: string): number {
  switch (pref) {
    case "very_slow":
      return 0.7;
    case "slow":
      return 0.85;
    case "fast":
      return 1.15;
    case "very_fast":
      return 1.3;
    default:
      return 1.0;
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

// Sent as a system message right after the student's message: editing the system prompt
// instead would invalidate the cached prompt and conversation for that turn.
const VOICE_OBSERVATION =
  "=== VOICE OBSERVATION ===\nThe student's voice sounds noticeably different from their usual voice today. They might be sick, tired, or feeling off. You can gently and naturally ask if they're feeling okay — don't make a big deal of it, just show you noticed. One brief mention is enough.";

const onboardingDoneNote = (level: string) =>
  `=== ONBOARDING COMPLETE ===\nOnboarding is finished: the student's level is ${level}. Stop the onboarding questions and the <onboarding> tags, and carry on with a normal lesson at that level.`;

// Notes the session holds for the model, delivered together as one system message after the
// student's next message (two system messages in a row would be rejected).
function pendingNotes(session: LessonSession): string[] {
  const notes: string[] = [];
  if (session.voiceMismatch) {
    notes.push(VOICE_OBSERVATION);
  }
  if (session.onboardingNoteLevel) {
    notes.push(onboardingDoneNote(session.onboardingNoteLevel));
  }
  return notes;
}

// Messages before the student's latest one that fact extraction gets as context.
const FACT_CONTEXT_MESSAGES = 8;

// Moderation normally answers within a second; past this the turn goes on without it, as on a failure
const MODERATION_TIMEOUT_MS = 3000;

// How long a student may stay away before a lesson they left is ended for them
const FINALIZE_AFTER_MS = 30 * 60 * 1000;

const finalizeJobId = (lessonId: string) => `finalize-${lessonId}`;

// Retried jobs whose ids make a second run for the same lesson a no-op
const RETRIED_JOB = { attempts: 3, backoff: { type: "exponential", delay: 10_000 } };

// Used when the model refuses or returns nothing for the greeting
const FALLBACK_GREETING = "<emotion>happy</emotion>Hey, great to see you! How are you doing today?";

const NO_USAGE: LlmResponse = {
  text: "",
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
  refused: false,
};

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(onTimeout()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Chunks are sentences; join them the way the client shows them
function joinChunks(text: string, chunk: string): string {
  return text && !/^[,.\-!?;:'"]/.test(chunk) ? `${text} ${chunk}` : `${text}${chunk}`;
}

@Injectable()
export class LessonMaintainer {
  private readonly logger = new Logger(LessonMaintainer.name);

  constructor(
    private authContract: AuthContract,
    private lessonRepository: LessonRepository,
    private messageRepository: LessonMessageRepository,
    private contextService: LessonContextService,
    private responseService: LessonResponseService,
    private streamingPipeline: StreamingPipelineService,
    private sessionService: LessonSessionService,
    private moderationService: ModerationService,
    @InjectQueue(QUEUE_NAMES.POST_LESSON) private postLessonQueue: Queue,
    @InjectQueue(QUEUE_NAMES.FACT_EXTRACTION) private factQueue: Queue,
    @InjectQueue(QUEUE_NAMES.LESSON_FINALIZE) private finalizeQueue: Queue,
  ) {}

  async getLesson(lessonId: string, userId: string) {
    const lesson = await this.lessonRepository.findById(lessonId);
    if (lesson?.userId !== userId) {
      return null;
    }
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

  async ownsLesson(lessonId: string, userId: string): Promise<boolean> {
    const lesson = await this.lessonRepository.findById(lessonId);
    return lesson?.userId === userId;
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

    const isOnboarding = !context.onboardingCompleted;

    const systemPrompt = buildFullSystemPrompt(context);

    const greeting = await this.responseService.generate(
      systemPrompt,
      [{ role: "user", content: pickGreetingPrompt() }],
      "lesson.greeting",
    );
    let greetingText = greeting.text;
    let reply = parseTutorReply(greetingText);
    if (greeting.tokens.refused || !reply.cleanText) {
      this.logger.warn(`Greeting ${greeting.tokens.refused ? "refused" : "empty"} for ${userId}, using the fallback`);
      greetingText = FALLBACK_GREETING;
      reply = parseTutorReply(greetingText);
    }

    const lesson = await this.lessonRepository.createWithGreeting(
      {
        userId,
        lessonNumber: context.lessonNumber,
      },
      reply.cleanText,
    );
    const speechSpeed = toSpeechSpeed(reply.speed ?? context.preferences.speakingSpeed);

    return {
      lessonId: lesson.id,
      systemPrompt,
      voiceId: context.tutorVoiceId,
      speechSpeed,
      ttsModel: context.preferences.ttsModel,
      // rawText goes into the LLM history, the rest to the student
      greeting: {
        rawText: greetingText,
        text: reply.cleanText,
        emotion: reply.emotion,
        vocabHighlights: reply.vocabHighlights,
      },
      isOnboarding,
    };
  }

  // Runs one turn and resolves once it is settled in history: committed, discarded, or recorded as
  // interrupted when the signal aborts the stream. Await it before starting the next turn.
  async processTextMessageStreaming(
    userId: string,
    text: string,
    callbacks: StreamCallbacks,
    options?: { signal?: AbortSignal },
  ): Promise<void> {
    const session = await this.sessionService.get(userId);
    if (!session) {
      return;
    }

    // Layer 1: Regex pre-filter (instant, <1ms)
    const quickResult = this.moderationService.quickCheck(text);
    if (!quickResult.isSafe) {
      this.logger.warn(`Regex flagged input from ${userId}: reason="${quickResult.reason}"`);
      this.emitSafetyResponse(callbacks);
      return;
    }

    // This turn's messages. Notes stay pending in the session until they are stored with a reply.
    const turn: LlmMessage[] = [{ role: "user", content: text }];
    const notes = pendingNotes(session);
    if (notes.length > 0) {
      turn.push({ role: "system", content: notes.join("\n\n") });
    }

    // Layer 2: LLM moderation runs in parallel with streaming.
    // Optimistic strategy: chunks are sent to client immediately (no buffering).
    // The verdict decides what reaches the history once the stream ends or is cut short.
    const moderationPromise = withTimeout(
      this.moderationService.llmCheck(text, { userId, lessonId: session.lessonId }),
      MODERATION_TIMEOUT_MS,
      (): ModerationCheckResult => {
        this.logger.warn(`LLM moderation timed out after ${MODERATION_TIMEOUT_MS}ms, allowing message`);
        return { isSafe: true, reason: null, confidence: 0 };
      },
    ).catch((err: unknown): ModerationCheckResult => {
      this.logger.error(`LLM moderation failed, allowing message: ${err instanceof Error ? err.message : String(err)}`);
      return { isSafe: true, reason: null, confidence: 0 };
    });

    const vocabBuffer = new VocabTagBuffer();
    const exerciseBuffer = new ExerciseTagBuffer();
    const unknownTagBuffer = new UnknownTagBuffer();
    // What the student has been shown so far, kept for a turn that gets cut short
    let shownText = "";
    // An exercise this reply opened; dropped again if the reply is discarded
    let exerciseOpened = false;
    const openExercise = (exercise: ParsedExercise) => {
      const exerciseId = randomUUID();
      exerciseOpened = true;
      this.sessionService.setActiveExercise(userId, exerciseId, exercise).catch((error: unknown) => {
        this.logger.error(`Failed to save the exercise: ${error instanceof Error ? error.message : String(error)}`);
      });
      callbacks.onExercise?.({ exerciseId, type: exercise.type, pairs: exercise.pairs });
    };
    const show = (chunkIndex: number, chunkText: string) => {
      shownText = joinChunks(shownText, chunkText);
      callbacks.onChunk({ chunkIndex, text: chunkText });
    };

    const result = await this.streamingPipeline.stream(
      session.systemPrompt,
      [...session.history, ...turn],
      {
        onChunk: (chunk) => {
          this.logger.debug(`RAW chunk: "${chunk.text}"`);
          const { cleanText: noSpeed } = stripSpeedTags(chunk.text);
          const { text: noEmotion } = parseEmotion(noSpeed);
          const { cleanText: noOnboarding } = stripOnboardingTags(noEmotion);
          const { cleanText, highlights, reviewedWords } = vocabBuffer.push(noOnboarding);

          if (highlights.length > 0) {
            this.logger.log(`Vocab highlights extracted: ${highlights.map((h) => h.word).join(", ")}`);
          }
          for (const h of highlights) {
            callbacks.onVocabHighlight?.(h);
          }
          for (const w of reviewedWords) {
            callbacks.onVocabReviewed?.(w);
          }

          const { cleanText: finalText, exercise } = exerciseBuffer.push(cleanText);
          if (exercise) {
            openExercise(exercise);
          }

          // Last step: catch any unknown XML tags that slipped through
          const safeText = unknownTagBuffer.push(finalText);
          if (safeText) {
            show(chunk.chunkIndex, safeText);
          }
        },
        onEnd: () => {
          // Flush any remaining buffered vocab tags
          const remaining = vocabBuffer.flush();
          if (remaining.highlights.length > 0) {
            this.logger.log(`Vocab flush highlights: ${remaining.highlights.map((h) => h.word).join(", ")}`);
          }
          for (const h of remaining.highlights) {
            callbacks.onVocabHighlight?.(h);
          }
          for (const w of remaining.reviewedWords) {
            callbacks.onVocabReviewed?.(w);
          }
          if (remaining.cleanText) {
            show(-1, remaining.cleanText);
          }

          const exerciseRemaining = exerciseBuffer.flush();
          if (exerciseRemaining.exercise) {
            openExercise(exerciseRemaining.exercise);
          }
          if (exerciseRemaining.cleanText) {
            const safeRemaining = unknownTagBuffer.push(exerciseRemaining.cleanText);
            if (safeRemaining) {
              show(-1, safeRemaining);
            }
          }

          // Flush unknown tag buffer — catch any incomplete tags at stream end
          const unknownRemaining = unknownTagBuffer.flush();
          if (unknownRemaining) {
            show(-1, unknownRemaining);
          }
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

    const aborted = options?.signal?.aborted ?? false;
    if (!(result || aborted)) {
      // The stream failed and onError reported it; nothing is stored, a voice note stays pending
      return;
    }

    try {
      const flagged = this.isFlagged(userId, await moderationPromise);
      if (result) {
        const discarded = flagged || result.tokens.refused;
        if (discarded && exerciseOpened) {
          await this.sessionService.clearActiveExercise(userId);
        }
        await this.commitTurn(userId, session, text, turn, result, discarded, callbacks, aborted);
      } else {
        await this.recordInterruptedTurn(userId, session, text, turn, shownText, flagged);
      }
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private isFlagged(userId: string, modResult: ModerationCheckResult): boolean {
    if (modResult.isSafe) {
      return false;
    }
    if (modResult.confidence < 0.7) {
      this.logger.warn(
        `LLM moderation below threshold, allowing: reason=${modResult.reason}, confidence=${modResult.confidence}`,
      );
      return false;
    }
    this.logger.warn(
      `LLM flagged input from ${userId}: reason=${modResult.reason}, confidence=${modResult.confidence}`,
    );
    return true;
  }

  // A reply that finished streaming is stored even if the student then cut its playback short.
  private async commitTurn(
    userId: string,
    session: LessonSession,
    text: string,
    turn: LlmMessage[],
    result: StreamResult,
    discarded: boolean,
    callbacks: StreamCallbacks,
    aborted: boolean,
  ) {
    if (discarded) {
      // The message itself stays out of the context, or every later request would carry it
      await this.sessionService.appendHistory(
        userId,
        { role: "user", content: BLOCKED_MESSAGE },
        { role: "assistant", content: SAFETY_RESPONSE },
      );
      if (!aborted) {
        callbacks.onDiscard?.(SAFETY_RESPONSE);
      }
      return;
    }

    this.logger.log(`RAW fullText: "${result.fullText}"`);
    // The reply is stored exactly as generated, tags included: the model keeps seeing its
    // own format, and the next request extends this one byte for byte (prompt cache).
    await this.sessionService.appendHistory(userId, ...turn, { role: "assistant", content: result.fullText });
    await this.clearDeliveredNotes(userId, session, turn);

    const reply = parseTutorReply(result.fullText);
    if (reply.vocabHighlights.length > 0) {
      this.logger.log(`Vocab from fullText: ${reply.vocabHighlights.map((h) => h.word).join(", ")}`);
    }
    // The onboarding prompt asks for the tag on every reply, so only the first completion counts
    if (reply.onboardingLevel && session.isOnboarding) {
      await this.authContract.completeOnboarding(userId, reply.onboardingLevel);
      await this.sessionService.completeOnboarding(userId, reply.onboardingLevel);
      callbacks.onOnboardingComplete?.({ level: reply.onboardingLevel });
    }
    if (reply.speed) {
      await this.sessionService.updateSpeechSpeed(userId, toSpeechSpeed(reply.speed));
      callbacks.onSpeedChange?.(reply.speed);
    }

    await this.saveTurnRecords(userId, session, text, reply.cleanText);
    if (!aborted) {
      callbacks.onEnd({ ...result, fullText: reply.cleanText });
    }
  }

  // The student cut the reply short: keep what they said and what they had been shown. A flagged
  // turn leaves no trace: the student never heard a safety reply, and the partial answer to the
  // flagged message shouldn't stay in context either.
  private async recordInterruptedTurn(
    userId: string,
    session: LessonSession,
    text: string,
    turn: LlmMessage[],
    shownText: string,
    flagged: boolean,
  ) {
    if (flagged) {
      return;
    }
    const shown = shownText.trim();
    if (shown) {
      await this.sessionService.appendHistory(userId, ...turn, { role: "assistant", content: `${shown}...` });
      await this.clearDeliveredNotes(userId, session, turn);
    } else {
      // A system note can't be stored without a reply after it; it stays pending for the next turn
      await this.sessionService.appendHistory(userId, { role: "user", content: text });
    }
    await this.saveTurnRecords(userId, session, text, shown ? `${shown}...` : null);
  }

  private async clearDeliveredNotes(userId: string, session: LessonSession, turn: LlmMessage[]) {
    if (turn.length > 1) {
      await this.sessionService.clearDeliveredNotes(userId, {
        voiceMismatch: session.voiceMismatch ?? false,
        onboardingNote: Boolean(session.onboardingNoteLevel),
      });
    }
  }

  private async saveTurnRecords(userId: string, session: LessonSession, text: string, tutorText: string | null) {
    await this.messageRepository.create({ lessonId: session.lessonId, role: "user", content: text });
    if (tutorText) {
      await this.messageRepository.create({ lessonId: session.lessonId, role: "tutor", content: tutorText });
    }

    // Facts are read at the next lesson start; a short window of context keeps this call's cost flat
    const context = session.history.filter((m) => m.role !== "system").slice(-FACT_CONTEXT_MESSAGES);
    await this.factQueue.add("extract", {
      userId,
      lessonId: session.lessonId,
      userMessage: text,
      history: toTranscript(context),
    });
  }

  private emitSafetyResponse(callbacks: StreamCallbacks) {
    callbacks.onChunk({ chunkIndex: 0, text: SAFETY_RESPONSE });
    callbacks.onEnd({ fullText: SAFETY_RESPONSE, tokens: NO_USAGE });
  }

  // Called when the student's last connection closes. Without it, a lesson left by closing the
  // tab stays active forever and never gets its summary, vocabulary and progress.
  async scheduleFinalize(userId: string) {
    const session = await this.sessionService.get(userId);
    if (!session) {
      return;
    }
    const jobId = finalizeJobId(session.lessonId);
    // A finished or failed job with the same id would make this add a silent no-op
    await this.finalizeQueue.remove(jobId).catch(() => 0);
    await this.finalizeQueue.add(
      "finalize",
      { userId, lessonId: session.lessonId, scheduledAt: Date.now() },
      { ...RETRIED_JOB, jobId, delay: FINALIZE_AFTER_MS },
    );
  }

  async cancelFinalize(lessonId: string) {
    await this.finalizeQueue.remove(finalizeJobId(lessonId));
  }

  // Returns false when the lesson was already ended, replaced by a newer one, or resumed after the
  // job was scheduled (removing the job can fail once it has started running).
  async finalizeAbandonedLesson(userId: string, lessonId: string, scheduledAt: number): Promise<boolean> {
    const session = await this.sessionService.get(userId);
    if (session?.lessonId !== lessonId || (session.lastSeenAt ?? 0) > scheduledAt) {
      return false;
    }
    await this.endLesson(lessonId, session.history);
    await this.sessionService.delete(userId);
    return true;
  }

  async endLesson(lessonId: string, history: LlmMessage[]) {
    await this.lessonRepository.complete(lessonId, {});

    // One summary per lesson, even if it is ended twice (the button, then the finalize job)
    await this.postLessonQueue.add(
      "process",
      { lessonId, conversationHistory: toTranscript(history) },
      { ...RETRIED_JOB, jobId: `post-lesson-${lessonId}` },
    );
  }
}
