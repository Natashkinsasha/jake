import { Inject, Injectable, NotFoundException, forwardRef } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRepository } from "../../infrastructure/repository/user.repository";
import { GoogleAuthBody } from "../../presentation/dto/body/google-auth.body";
import { UpdatePreferencesBody } from "../../presentation/dto/body/update-preferences.body";
import { MemoryContract } from "../../../memory/contract/memory.contract";
import { VocabularyContract } from "../../../vocabulary/contract/vocabulary.contract";
import { ProgressContract } from "../../../progress/contract/progress.contract";
import { LessonRepository } from "../../../lesson/infrastructure/repository/lesson.repository";

@Injectable()
export class AuthMaintainer {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private memoryContract: MemoryContract,
    private vocabularyContract: VocabularyContract,
    private progressContract: ProgressContract,
    @Inject(forwardRef(() => LessonRepository)) private lessonRepository: LessonRepository,
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

  async resetAccount(userId: string): Promise<void> {
    await this.lessonRepository.deleteByUser(userId);
    await this.memoryContract.deleteByUser(userId);
    await this.vocabularyContract.deleteByUser(userId);
    await this.progressContract.deleteByUser(userId);
    await this.userRepository.resetUserFields(userId);
  }
}
