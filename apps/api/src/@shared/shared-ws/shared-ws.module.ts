import { Module } from "@nestjs/common";
import { SharedAuthModule } from "../shared-auth/shared-auth.module";
import { WsAuthGuard } from "./ws-auth.guard";

@Module({
  imports: [SharedAuthModule],
  providers: [WsAuthGuard],
  exports: [WsAuthGuard],
})
export class SharedWsModule {}
