import { Module } from "@nestjs/common";
import { AuthController } from "./presentation/controller/auth.controller";
import { AuthMaintainer } from "./application/maintainer/auth.maintainer";
import { JwtTokenService } from "./application/service/jwt-token.service";
import { UserDao } from "./infrastructure/dao/user.dao";

@Module({
  controllers: [AuthController],
  providers: [AuthMaintainer, JwtTokenService, UserDao],
  exports: [UserDao],
})
export class AuthModule {}
