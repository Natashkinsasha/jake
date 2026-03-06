import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { SharedConfigModule } from "../shared-config/shared-config.module";
import { EnvService } from "../shared-config/env.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [
    SharedConfigModule,
    JwtModule.registerAsync({
      imports: [SharedConfigModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => ({ secret: env.get("JWT_SECRET") }),
    }),
  ],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class SharedAuthModule {}
