import { Controller, Get, Param, Post, Body, UseGuards, NotFoundException } from "@nestjs/common";
import { LessonMaintainer } from "../../application/maintainer/lesson.maintainer";
import { JwtAuthGuard } from "../../../../@shared/shared-auth/jwt-auth.guard";
import { CurrentUserId } from "../../../../@shared/shared-auth/current-user.decorator";
import { EndLessonBody } from "../dto/body/end-lesson.body";
import { SttMetricsBody } from "../dto/body/stt-metrics.body";
import { withSpan } from "../../../../@lib/llm/src/llm-tracing";

@Controller("lessons")
@UseGuards(JwtAuthGuard)
export class LessonController {
  constructor(private lessonMaintainer: LessonMaintainer) {}

  @Get()
  async listLessons(@CurrentUserId() userId: string) {
    return this.lessonMaintainer.listLessons(userId);
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
      "deepgram.stt",
      {
        "stt.provider": "deepgram",
        "stt.model": "nova-3",
        "stt.duration_ms": body.durationMs,
        "stt.transcript_length": body.transcriptLength,
        "stt.segments": body.segments,
      },
      async () => {},
    );
    return { success: true };
  }
}
