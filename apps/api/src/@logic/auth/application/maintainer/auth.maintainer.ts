import { Injectable, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserDao } from "../../infrastructure/dao/user.dao";
import { TutorDao } from "../../../tutor/infrastructure/dao/tutor.dao";
import { UserTutorDao } from "../../../tutor/infrastructure/dao/user-tutor.dao";
import { GoogleAuthBody } from "../../presentation/dto/body/google-auth.body";
import { UpdatePreferencesBody } from "../../presentation/dto/body/update-preferences.body";

@Injectable()
export class AuthMaintainer {
  constructor(
    private userDao: UserDao,
    private jwtService: JwtService,
    private tutorDao: TutorDao,
    private userTutorDao: UserTutorDao,
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

      // Auto-assign first active tutor
      const activeTutors = await this.tutorDao.findActive();
      if (activeTutors.length > 0) {
        await this.userTutorDao.selectTutor(user.id, activeTutors[0].id);
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
