import { Body, Controller, Get, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthMaintainer } from "../../application/maintainer/auth.maintainer";
import { GoogleAuthBody } from "../dto/body/google-auth.body";
import { JwtAuthGuard } from "../../../../@shared/shared-auth/jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private authMaintainer: AuthMaintainer) {}

  @Post("google")
  async googleAuth(@Body() body: GoogleAuthBody) {
    return this.authMaintainer.googleAuth(body);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    return this.authMaintainer.getProfile(req.user.sub);
  }

  @Put("me/preferences")
  @UseGuards(JwtAuthGuard)
  async updatePreferences(@Req() req: any, @Body() body: any) {
    await this.authMaintainer.updatePreferences(req.user.sub, body);
    return { success: true };
  }
}
