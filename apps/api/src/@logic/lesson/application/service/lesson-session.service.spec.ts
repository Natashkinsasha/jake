import type { RedisService } from "@liaoliaots/nestjs-redis";
import { type LessonSession, LessonSessionService } from "./lesson-session.service";

// Redis stand-in whose calls resolve after a random delay, so unordered writes would interleave.
class SlowRedis {
  readonly store = new Map<string, string>();

  async get(key: string) {
    await this.pause();
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string) {
    await this.pause();
    this.store.set(key, value);
    return "OK";
  }

  async del(key: string) {
    await this.pause();
    this.store.delete(key);
    return 1;
  }

  private pause() {
    return new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
  }
}

function lastMessage(stored: LessonSession | null): string | undefined {
  return stored?.history[stored.history.length - 1]?.content;
}

const session: LessonSession = {
  lessonId: "lesson-1",
  systemPrompt: "system",
  voiceId: "voice",
  speechSpeed: 1,
  history: [{ role: "assistant", content: "Hey!" }],
  startedAt: 0,
};

describe("LessonSessionService", () => {
  let redis: SlowRedis;
  let service: LessonSessionService;

  beforeEach(async () => {
    redis = new SlowRedis();
    service = new LessonSessionService({ getOrThrow: () => redis } as unknown as RedisService);
    await service.save("u1", session);
  });

  it("keeps every concurrent update", async () => {
    await Promise.all([
      service.appendHistory("u1", { role: "user", content: "one" }),
      service.setActiveExercise("u1", "ex-1", { type: "matching", pairs: [] }),
      service.updateSpeechSpeed("u1", 0.85),
      service.appendHistory("u1", { role: "user", content: "two" }),
      service.setVoiceMismatch("u1", true),
    ]);

    const stored = await service.get("u1");
    expect(stored?.history.map((m) => m.content)).toEqual(["Hey!", "one", "two"]);
    expect(stored?.activeExercise?.id).toBe("ex-1");
    expect(stored?.speechSpeed).toBe(0.85);
    expect(stored?.voiceMismatch).toBe(true);
  });

  it("reads after writes that are already queued", async () => {
    void service.appendHistory("u1", { role: "user", content: "just committed" });

    expect(lastMessage(await service.get("u1"))).toBe("just committed");
  });

  it("does not recreate a deleted session", async () => {
    await Promise.all([service.delete("u1"), service.appendHistory("u1", { role: "user", content: "late" })]);

    expect(await service.get("u1")).toBeNull();
    expect(redis.store.size).toBe(0);
  });

  it("keeps processing writes after one fails", async () => {
    const set = jest.spyOn(redis, "set").mockRejectedValueOnce(new Error("redis down"));

    await expect(service.appendHistory("u1", { role: "user", content: "lost" })).rejects.toThrow("redis down");
    set.mockRestore();
    await service.appendHistory("u1", { role: "user", content: "kept" });

    expect(lastMessage(await service.get("u1"))).toBe("kept");
  });
});
