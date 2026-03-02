import { Controller, Get, Param, Post, Body, UseGuards } from "@nestjs/common";
import { HomeworkMaintainer } from "../../application/maintainer/homework.maintainer";
import { JwtAuthGuard } from "../../../../@shared/shared-auth/jwt-auth.guard";
import { CurrentUser } from "../../../../@shared/shared-auth/current-user.decorator";
import { SubmitHomeworkBody } from "../dto/body/submit-homework.body";

@Controller("homework")
@UseGuards(JwtAuthGuard)
export class HomeworkController {
  constructor(private homeworkMaintainer: HomeworkMaintainer) {}

  @Get()
  async listHomework(@CurrentUser() userId: string) {
    return this.homeworkMaintainer.listHomework(userId);
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    return this.homeworkMaintainer.getById(id);
  }

  @Post(":id/submit")
  async submit(@Param("id") id: string, @Body() body: SubmitHomeworkBody) {
    return this.homeworkMaintainer.submit(id, body.answers);
  }
}
