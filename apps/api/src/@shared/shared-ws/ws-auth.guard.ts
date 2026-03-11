import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";
import type { Socket } from "socket.io";

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const auth = client.handshake.auth as Record<string, unknown>;
    const query = client.handshake.query;
    const token =
      (auth["token"] as string | undefined) ??
      (query["token"] as string | undefined) ??
      client.handshake.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      throw new WsException("Unauthorized");
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      (client.data as { userId: string }) = { userId: payload.sub };
      return true;
    } catch {
      // biome-ignore lint/nursery/useErrorCause: WsException only accepts string
      throw new WsException("Invalid token");
    }
  }
}
