import { Controller, Get, Param, Post, Body, Req, UseGuards } from "@nestjs/common";
import { HomeworkMaintainer } from "../../application/maintainer/homework.maintainer";
import { JwtAuthGuard } from "../../../../@shared/shared-auth/jwt-auth.guard";

@Controller("homework")
@UseGuards(JwtAuthGuard)
export class HomeworkController {
  constructor(private homeworkMaintainer: HomeworkMaintainer) {}

  @Get()
  async listHomework(@Req() req: any) {
    return this.homeworkMaintainer.listHomework(req.user.sub);
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    return this.homeworkMaintainer.getById(id);
  }

  @Post(":id/submit")
  async submit(@Param("id") id: string, @Body() body: { answers: Record<string, string> }) {
    return this.homeworkMaintainer.submit(id, body.answers);
  }
}
