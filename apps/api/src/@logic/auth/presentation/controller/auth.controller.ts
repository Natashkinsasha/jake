import { Body, Controller, Post } from "@nestjs/common";
import { AuthMaintainer } from "../../application/maintainer/auth.maintainer";
import { GoogleAuthBody } from "../dto/body/google-auth.body";

@Controller("auth")
export class AuthController {
  constructor(private authMaintainer: AuthMaintainer) {}

  @Post("google")
  async googleAuth(@Body() body: GoogleAuthBody) {
    return this.authMaintainer.googleAuth(body);
  }
}
