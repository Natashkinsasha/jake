import { Inject, Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS } from "../../../../@shared/shared-redis/redis.provider";
import { LlmMessage } from "../../../../@lib/llm/src/llm.service";

export interface LessonSession {
  lessonId: string;
  systemPrompt: string;
  voiceId: string;
  history: LlmMessage[];
}

const SESSION_TTL = 7200; // 2 hours
const KEY_PREFIX = "lesson:session:";

@Injectable()
export class LessonSessionService {
  private readonly logger = new Logger(LessonSessionService.name);

  constructor(@Inject(REDIS) private redis: Redis) {}

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

  async appendHistory(socketId: string, ...messages: LlmMessage[]): Promise<void> {
    const session = await this.get(socketId);
    if (!session) return;
    session.history.push(...messages);
    await this.save(socketId, session);
  }
}
