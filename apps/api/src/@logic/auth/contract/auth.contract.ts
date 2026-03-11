import { Injectable } from "@nestjs/common";
import type { UserWithPreferences } from "../domain/entity/user.entity";
import type { UserRepository } from "../infrastructure/repository/user.repository";

@Injectable()
export class AuthContract {
  constructor(private userRepository: UserRepository) {}

  async findByIdWithPreferences(userId: string): Promise<UserWithPreferences | null> {
    return this.userRepository.findByIdWithPreferences(userId);
  }

  async updateLevel(userId: string, level: string): Promise<void> {
    return this.userRepository.updateLevel(userId, level);
  }

  async completeOnboarding(userId: string, level: string): Promise<void> {
    return this.userRepository.completeOnboarding(userId, level);
  }
}
