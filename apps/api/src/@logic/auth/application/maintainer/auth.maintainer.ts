import { Injectable, NotFoundException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { Transaction } from "@shared/shared-cls/transaction";
import type { LessonContract } from "../../../lesson/contract/lesson.contract";
import type { MemoryContract } from "../../../memory/contract/memory.contract";
import type { ProgressContract } from "../../../progress/contract/progress.contract";
import type { VocabularyContract } from "../../../vocabulary/contract/vocabulary.contract";
import type { UserRepository } from "../../infrastructure/repository/user.repository";
import type { GoogleAuthBody } from "../../presentation/dto/body/google-auth.body";
import type { UpdatePreferencesBody } from "../../presentation/dto/body/update-preferences.body";

@Injectable()
export class AuthMaintainer {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private lessonContract: LessonContract,
    private memoryContract: MemoryContract,
    private vocabularyContract: VocabularyContract,
    private progressContract: ProgressContract,
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
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async updatePreferences(userId: string, data: UpdatePreferencesBody) {
    await this.userRepository.updatePreferences(userId, data);
  }

  @Transaction()
  async resetAccount(userId: string): Promise<void> {
    await this.vocabularyContract.deleteByUser(userId);
    await this.memoryContract.deleteByUser(userId);
    await this.progressContract.deleteByUser(userId);
    await this.lessonContract.deleteByUser(userId);
    await this.userRepository.resetUserFields(userId);
  }
}
