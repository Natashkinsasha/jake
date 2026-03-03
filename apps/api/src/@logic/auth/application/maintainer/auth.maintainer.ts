import { Injectable, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserDao } from "../../infrastructure/dao/user.dao";
import { TutorRepository } from "../../../tutor/infrastructure/repository/tutor.repository";
import { UserTutorRepository } from "../../../tutor/infrastructure/repository/user-tutor.repository";
import { GoogleAuthBody } from "../../presentation/dto/body/google-auth.body";
import { UpdatePreferencesBody } from "../../presentation/dto/body/update-preferences.body";

@Injectable()
export class AuthMaintainer {
  constructor(
    private userDao: UserDao,
    private jwtService: JwtService,
    private tutorRepository: TutorRepository,
    private userTutorRepository: UserTutorRepository,
  ) {}

  async googleAuth(googleUser: GoogleAuthBody) {
    let user = await this.userDao.findByGoogleId(googleUser.googleId);

    if (!user) {
      user = await this.userDao.create({
        googleId: googleUser.googleId,
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.avatarUrl,
      });
    }

    // Ensure user has an active tutor
    const activeTutor = await this.userTutorRepository.findActiveByUser(user.id);
    if (!activeTutor) {
      const activeTutors = await this.tutorRepository.findActive();
      if (activeTutors.length > 0) {
        await this.userTutorRepository.selectTutor(user.id, activeTutors[0].id);
      }
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return { token, user };
  }

  async getProfile(userId: string) {
    const user = await this.userDao.findByIdWithPreferences(userId);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async updatePreferences(userId: string, data: UpdatePreferencesBody) {
    await this.userDao.updatePreferences(userId, data);
  }
}
