import { Injectable } from "@nestjs/common";
import { UserRepository } from "../infrastructure/repository/user.repository";
import { type UserWithPreferences } from "../domain/entity/user.entity";

@Injectable()
export class AuthContract {
  constructor(private userRepository: UserRepository) {}

  async findByIdWithPreferences(userId: string): Promise<UserWithPreferences | null> {
    return this.userRepository.findByIdWithPreferences(userId);
  }

  async updateLevel(userId: string, level: string): Promise<void> {
    return this.userRepository.updateLevel(userId, level);
  }
}
