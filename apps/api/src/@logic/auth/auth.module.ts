import { Module } from "@nestjs/common";
import { SharedDrizzlePgModule } from "@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedAuthModule } from "@shared/shared-auth/shared-auth.module";
import { TutorModule } from "../tutor/tutor.module";
import { AuthController } from "./presentation/controller/auth.controller";
import { AuthMaintainer } from "./application/maintainer/auth.maintainer";
import { JwtTokenService } from "./application/service/jwt-token.service";
import { UserRepository } from "./infrastructure/repository/user.repository";
import { AuthContract } from "./contract/auth.contract";

@Module({
  imports: [SharedDrizzlePgModule, SharedAuthModule, TutorModule],
  controllers: [AuthController],
  providers: [AuthMaintainer, JwtTokenService, UserRepository, AuthContract],
  exports: [AuthContract],
})
export class AuthModule {}
