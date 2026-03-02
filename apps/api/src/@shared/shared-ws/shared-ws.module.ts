import { Global, Module } from "@nestjs/common";
import { WsAuthGuard } from "./ws-auth.guard";

@Global()
@Module({
  providers: [WsAuthGuard],
  exports: [WsAuthGuard],
})
export class SharedWsModule {}
