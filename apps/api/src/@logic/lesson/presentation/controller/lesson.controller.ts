import { Controller, Get, Param, Post, Body, Query, UseGuards, NotFoundException, HttpException } from "@nestjs/common";
import { JwtAuthGuard } from "@shared/shared-auth/jwt-auth.guard";
import { CurrentUserId } from "@shared/shared-auth/current-user.decorator";
import { EnvService } from "@shared/shared-config/env.service";
import { LessonMaintainer } from "../../application/maintainer/lesson.maintainer";
import { EndLessonBody } from "../dto/body/end-lesson.body";
import { SttMetricsBody } from "../dto/body/stt-metrics.body";
import { withSpan } from "../../../llm/src/llm-tracing";

@Controller("lessons")
@UseGuards(JwtAuthGuard)
export class LessonController {
  private sttTokenHits = new Map<string, { count: number; resetAt: number }>();
  private ttsTokenHits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private lessonMaintainer: LessonMaintainer,
    private env: EnvService,
  ) {}

  @Get()
  async listLessons(
    @CurrentUserId() userId: string,
    @Query("offset") rawOffset?: string,
    @Query("limit") rawLimit?: string,
  ) {
    const offset = Math.max(0, Number(rawOffset) || 0);
    const limit = Math.min(50, Math.max(1, Number(rawLimit) || 10));
    return this.lessonMaintainer.listLessons(userId, offset, limit);
  }

  @Get("stt/token")
  async sttToken(@CurrentUserId() userId: string) {
    const now = Date.now();
    const entry = this.sttTokenHits.get(userId);

    if (entry && now < entry.resetAt) {
      entry.count++;
      if (entry.count > 10) {
        throw new HttpException("Too many requests", 429);
      }
    } else {
      this.sttTokenHits.set(userId, { count: 1, resetAt: now + 10 * 60 * 1000 });
    }

    const apiKey = this.env.get("DEEPGRAM_API_KEY");
    if (!apiKey) {
      throw new HttpException("DEEPGRAM_API_KEY not configured", 500);
    }

    const grantRes = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 300 }),
    }).catch(() => null);

    if (grantRes?.ok) {
      const data = (await grantRes.json()) as { access_token: string };
      return { key: data.access_token };
    }

    return { key: apiKey };
  }

  @Get("tts/token")
  async ttsToken(@CurrentUserId() userId: string) {
    const now = Date.now();
    const entry = this.ttsTokenHits.get(userId);

    if (entry && now < entry.resetAt) {
      entry.count++;
      if (entry.count > 100) {
        throw new HttpException("Too many requests", 429);
      }
    } else {
      this.ttsTokenHits.set(userId, { count: 1, resetAt: now + 10 * 60 * 1000 });
    }

    const apiKey = this.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      throw new HttpException("ELEVENLABS_API_KEY not configured", 500);
    }

    const res = await fetch("https://api.elevenlabs.io/v1/single-use-token/tts_websocket", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ allowed_voice_ids: ["*"] }),
    }).catch(() => null);

    if (!res?.ok) {
      const body = await res?.text().catch(() => "");
      throw new HttpException(`ElevenLabs token error: ${body}`, 502);
    }

    const data = (await res.json()) as { token: string };
    return { token: data.token };
  }

  @Get(":id")
  async getLesson(@Param("id") id: string) {
    const lesson = await this.lessonMaintainer.getLesson(id);
    if (!lesson) throw new NotFoundException("Lesson not found");
    return lesson;
  }

  @Post("end/:id")
  async endLesson(@Param("id") id: string, @Body() body: EndLessonBody) {
    await this.lessonMaintainer.endLesson(id, body.history);
    return { success: true };
  }

  @Post("stt/metrics")
  async sttMetrics(@Body() body: SttMetricsBody) {
    await withSpan(
      "stt.browser-session",
      {
        provider: "deepgram",
        model: "nova-3",
        duration_ms: body.durationMs,
        transcript_length: body.transcriptLength,
        segments: body.segments,
      },
      async () => {},
    );
    return { success: true };
  }
}
