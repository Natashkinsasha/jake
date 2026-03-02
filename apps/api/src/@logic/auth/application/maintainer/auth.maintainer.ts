import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserDao } from "../../infrastructure/dao/user.dao";
import { Transaction } from "../../../../@shared/shared-cls/transaction";

@Injectable()
export class AuthMaintainer {
  constructor(
    private userDao: UserDao,
    private jwtService: JwtService,
  ) {}

  @Transaction()
  async googleAuth(googleUser: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  }) {
    let user = await this.userDao.findByGoogleId(googleUser.googleId);

    if (!user) {
      user = await this.userDao.create({
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
}
