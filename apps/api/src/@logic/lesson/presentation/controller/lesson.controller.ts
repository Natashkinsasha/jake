import { Controller, Get, Param, Post, Body, UseGuards } from "@nestjs/common";
import { LessonMaintainer } from "../../application/maintainer/lesson.maintainer";
import { JwtAuthGuard } from "../../../../@shared/shared-auth/jwt-auth.guard";
import { CurrentUser } from "../../../../@shared/shared-auth/current-user.decorator";
import { EndLessonBody } from "../dto/body/end-lesson.body";

@Controller("lessons")
@UseGuards(JwtAuthGuard)
export class LessonController {
  constructor(private lessonMaintainer: LessonMaintainer) {}

  @Get()
  async listLessons(@CurrentUser() userId: string) {
    return this.lessonMaintainer.listLessons(userId);
  }

  @Post("end/:id")
  async endLesson(@Param("id") id: string, @Body() body: EndLessonBody) {
    await this.lessonMaintainer.endLesson(id, body.history);
    return { success: true };
  }
}
