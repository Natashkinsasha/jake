import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const token =
      client.handshake?.auth?.token ||
      client.handshake?.query?.token ||
      client.handshake?.headers?.authorization?.replace("Bearer ", "");

    if (!token) throw new WsException("Unauthorized");

    try {
      const payload = await this.jwtService.verifyAsync(token);
      client.data = { userId: payload.sub };
      return true;
    } catch {
      throw new WsException("Invalid token");
    }
  }
}
