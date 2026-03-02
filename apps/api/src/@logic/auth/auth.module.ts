import { Module } from "@nestjs/common";
import { SharedDrizzlePgModule } from "../../@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedAuthModule } from "../../@shared/shared-auth/shared-auth.module";
import { AuthController } from "./presentation/controller/auth.controller";
import { AuthMaintainer } from "./application/maintainer/auth.maintainer";
import { JwtTokenService } from "./application/service/jwt-token.service";
import { UserDao } from "./infrastructure/dao/user.dao";

@Module({
  imports: [SharedDrizzlePgModule, SharedAuthModule],
  controllers: [AuthController],
  providers: [AuthMaintainer, JwtTokenService, UserDao],
  exports: [UserDao],
})
export class AuthModule {}
