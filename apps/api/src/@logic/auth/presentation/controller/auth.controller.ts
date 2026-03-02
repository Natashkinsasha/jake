import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { AuthMaintainer } from "../../application/maintainer/auth.maintainer";
import { GoogleAuthBody } from "../dto/body/google-auth.body";
import { UpdatePreferencesBody } from "../dto/body/update-preferences.body";
import { JwtAuthGuard } from "../../../../@shared/shared-auth/jwt-auth.guard";
import { CurrentUser } from "../../../../@shared/shared-auth/current-user.decorator";

@Controller("auth")
export class AuthController {
  constructor(private authMaintainer: AuthMaintainer) {}

  @Post("google")
  async googleAuth(@Body() body: GoogleAuthBody) {
    return this.authMaintainer.googleAuth(body);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() userId: string) {
    return this.authMaintainer.getProfile(userId);
  }

  @Put("me/preferences")
  @UseGuards(JwtAuthGuard)
  async updatePreferences(
    @CurrentUser() userId: string,
    @Body() body: UpdatePreferencesBody,
  ) {
    await this.authMaintainer.updatePreferences(userId, body);
    return { success: true };
  }
}
