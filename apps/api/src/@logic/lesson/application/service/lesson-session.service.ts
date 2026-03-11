import type { RedisService } from "@liaoliaots/nestjs-redis";
import type { LlmMessage } from "@lib/provider/src";
import { Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
import type { ParsedExercise } from "./exercise-tags";

export interface LessonSession {
  lessonId: string;
  systemPrompt: string;
  voiceId: string;
  speechSpeed: number;
  history: LlmMessage[];
  startedAt: number;
  isOnboarding?: boolean;
  voiceMismatch?: boolean;
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

  constructor(redisService: RedisService) {
    this.redis = redisService.getOrThrow();
  }

  async save(userId: string, session: LessonSession): Promise<void> {
    await this.redis.set(KEY_PREFIX + userId, JSON.stringify(session), "EX", SESSION_TTL);
  }

  async get(userId: string): Promise<LessonSession | null> {
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

  async delete(userId: string): Promise<void> {
    await this.redis.del(KEY_PREFIX + userId);
  }

  async updateSpeechSpeed(userId: string, speed: number): Promise<void> {
    const session = await this.get(userId);
    if (!session) {
      return;
    }
    session.speechSpeed = speed;
    await this.save(userId, session);
  }

  async setVoiceMismatch(userId: string, mismatch: boolean): Promise<void> {
    const session = await this.get(userId);
    if (!session) {
      return;
    }
    session.voiceMismatch = mismatch;
    await this.save(userId, session);
  }

  async appendHistory(userId: string, ...messages: LlmMessage[]): Promise<void> {
    const session = await this.get(userId);
    if (!session) {
      return;
    }
    session.history.push(...messages);
    await this.save(userId, session);
  }

  async setActiveExercise(userId: string, exerciseId: string, exercise: ParsedExercise): Promise<void> {
    const session = await this.get(userId);
    if (!session) {
      return;
    }
    session.activeExercise = { id: exerciseId, exercise };
    await this.save(userId, session);
  }

  async clearActiveExercise(userId: string): Promise<void> {
    const session = await this.get(userId);
    if (!session) {
      return;
    }
    session.activeExercise = null;
    await this.save(userId, session);
  }
}
