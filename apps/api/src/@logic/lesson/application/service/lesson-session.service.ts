import { RedisService } from "@liaoliaots/nestjs-redis";
import type { LlmMessage } from "@lib/provider/src";
import { Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
import type { ParsedExercise } from "./exercise-tags";

export interface LessonSession {
  lessonId: string;
  systemPrompt: string;
  voiceId: string;
  speechSpeed: number;
  // Append-only: every request extends the previous one byte for byte, which keeps the prompt cache warm.
  history: LlmMessage[];
  startedAt: number;
  // Last time a socket opened or resumed this lesson; a finalize job scheduled earlier backs off
  lastSeenAt?: number;
  isOnboarding?: boolean;
  // Pending notes for the model, sent with the next turn and cleared once stored with a reply
  voiceMismatch?: boolean;
  onboardingNoteLevel?: string | null;
  activeExercise?: {
    id: string;
    exercise: ParsedExercise;
  } | null;
}

const SESSION_TTL = 7200; // 2 hours
const KEY_PREFIX = "lesson:session:";

@Injectable()
export class LessonSessionService {
  private readonly logger = new Logger(LessonSessionService.name);
  private readonly redis: Redis;
  // Every write is a read-modify-write of one JSON value, so writes for a user run one at a
  // time; otherwise concurrent handlers drop each other's history or exercise. Assumes one API instance.
  private readonly writeQueues = new Map<string, Promise<unknown>>();

  constructor(redisService: RedisService) {
    this.redis = redisService.getOrThrow();
  }

  save(userId: string, session: LessonSession): Promise<void> {
    return this.serialize(userId, () => this.write(userId, session));
  }

  async get(userId: string): Promise<LessonSession | null> {
    // Read after the writes already queued for this user, e.g. a turn committed a moment ago
    await this.writeQueues.get(userId);
    return this.read(userId);
  }

  private async read(userId: string): Promise<LessonSession | null> {
    const data = await this.redis.get(KEY_PREFIX + userId);
    if (!data) {
      return null;
    }
    try {
      return JSON.parse(data) as LessonSession;
    } catch {
      this.logger.warn(`Failed to parse session for user ${userId}`);
      return null;
    }
  }

  delete(userId: string): Promise<void> {
    return this.serialize(userId, async () => {
      await this.redis.del(KEY_PREFIX + userId);
    });
  }

  updateSpeechSpeed(userId: string, speed: number): Promise<void> {
    return this.update(userId, (session) => {
      session.speechSpeed = speed;
    });
  }

  markSeen(userId: string): Promise<void> {
    return this.update(userId, (session) => {
      session.lastSeenAt = Date.now();
    });
  }

  setVoiceMismatch(userId: string, mismatch: boolean): Promise<void> {
    return this.update(userId, (session) => {
      session.voiceMismatch = mismatch;
    });
  }

  // Onboarding ends mid-lesson: later turns get a note, since the lesson's system prompt can't change
  completeOnboarding(userId: string, level: string): Promise<void> {
    return this.update(userId, (session) => {
      session.isOnboarding = false;
      session.onboardingNoteLevel = level;
    });
  }

  clearDeliveredNotes(userId: string, delivered: { voiceMismatch: boolean; onboardingNote: boolean }): Promise<void> {
    return this.update(userId, (session) => {
      if (delivered.voiceMismatch) {
        session.voiceMismatch = false;
      }
      if (delivered.onboardingNote) {
        session.onboardingNoteLevel = null;
      }
    });
  }

  appendHistory(userId: string, ...messages: LlmMessage[]): Promise<void> {
    return this.update(userId, (session) => {
      session.history.push(...messages);
    });
  }

  setActiveExercise(userId: string, exerciseId: string, exercise: ParsedExercise): Promise<void> {
    return this.update(userId, (session) => {
      session.activeExercise = { id: exerciseId, exercise };
    });
  }

  clearActiveExercise(userId: string): Promise<void> {
    return this.update(userId, (session) => {
      session.activeExercise = null;
    });
  }

  private update(userId: string, mutate: (session: LessonSession) => void): Promise<void> {
    return this.serialize(userId, async () => {
      const session = await this.read(userId);
      if (!session) {
        return;
      }
      mutate(session);
      await this.write(userId, session);
    });
  }

  private async write(userId: string, session: LessonSession): Promise<void> {
    await this.redis.set(KEY_PREFIX + userId, JSON.stringify(session), "EX", SESSION_TTL);
  }

  private async serialize<T>(userId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.writeQueues.get(userId) ?? Promise.resolve();
    const current = previous.then(task);
    const settled = current.catch(() => undefined);
    this.writeQueues.set(userId, settled);
    try {
      return await current;
    } finally {
      if (this.writeQueues.get(userId) === settled) {
        this.writeQueues.delete(userId);
      }
    }
  }
}
