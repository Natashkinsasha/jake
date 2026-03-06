import { Injectable, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRepository } from "../../infrastructure/repository/user.repository";
import { GoogleAuthBody } from "../../presentation/dto/body/google-auth.body";
import { UpdatePreferencesBody } from "../../presentation/dto/body/update-preferences.body";

@Injectable()
export class AuthMaintainer {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
  ) {}

  async googleAuth(googleUser: GoogleAuthBody) {
    let user = await this.userRepository.findByGoogleId(googleUser.googleId);

    if (!user) {
      user = await this.userRepository.create({
        googleId: googleUser.googleId,
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.avatarUrl,
      });
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return { token, user };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findByIdWithPreferences(userId);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async updatePreferences(userId: string, data: UpdatePreferencesBody) {
    await this.userRepository.updatePreferences(userId, data);
  }
}
