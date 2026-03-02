import { Controller, Get, Param, Post, Body, Req, UseGuards } from "@nestjs/common";
import { LessonMaintainer } from "../../application/maintainer/lesson.maintainer";
import { JwtAuthGuard } from "../../../../@shared/shared-auth/jwt-auth.guard";

@Controller("lessons")
@UseGuards(JwtAuthGuard)
export class LessonController {
  constructor(private lessonMaintainer: LessonMaintainer) {}

  @Get()
  async listLessons(@Req() req: any) {
    return this.lessonMaintainer.listLessons(req.user.sub);
  }

  @Post("end/:id")
  async endLesson(@Param("id") id: string, @Body() body: { history: any[] }) {
    await this.lessonMaintainer.endLesson(id, body.history);
    return { success: true };
  }
}
