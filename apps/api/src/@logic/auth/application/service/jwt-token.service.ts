import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class JwtTokenService {
  constructor(private jwtService: JwtService) {}

  async generateToken(userId: string, email: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId, email });
  }

  async verifyToken(token: string) {
    return this.jwtService.verifyAsync(token);
  }
}
