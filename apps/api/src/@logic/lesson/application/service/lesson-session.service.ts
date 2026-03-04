import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "@liaoliaots/nestjs-redis";
import type Redis from "ioredis";
import { LlmMessage } from "../../../llm/src/anthropic-llm.provider";

export interface LessonSession {
  lessonId: string;
  systemPrompt: string;
  voiceId: string;
  speechSpeed: number;
  history: LlmMessage[];
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

  async save(socketId: string, session: LessonSession): Promise<void> {
    await this.redis.set(
      KEY_PREFIX + socketId,
      JSON.stringify(session),
      "EX",
      SESSION_TTL,
    );
  }

  async get(socketId: string): Promise<LessonSession | null> {
    const data = await this.redis.get(KEY_PREFIX + socketId);
    if (!data) return null;
    try {
      return JSON.parse(data) as LessonSession;
    } catch {
      this.logger.warn(`Failed to parse session for socket ${socketId}`);
      return null;
    }
  }

  async delete(socketId: string): Promise<void> {
    await this.redis.del(KEY_PREFIX + socketId);
  }

  async updateSpeechSpeed(socketId: string, speed: number): Promise<void> {
    const session = await this.get(socketId);
    if (!session) return;
    session.speechSpeed = speed;
    await this.save(socketId, session);
  }

  async appendHistory(socketId: string, ...messages: LlmMessage[]): Promise<void> {
    const session = await this.get(socketId);
    if (!session) return;
    session.history.push(...messages);
    await this.save(socketId, session);
  }
}
