import { Controller, Get, Delete, Param, Query, UseGuards, NotFoundException } from "@nestjs/common";
import { JwtAuthGuard } from "@shared/shared-auth/jwt-auth.guard";
import { CurrentUserId } from "@shared/shared-auth/current-user.decorator";
import { VocabularyContract } from "../../contract/vocabulary.contract";

@Controller("vocabulary")
@UseGuards(JwtAuthGuard)
export class VocabularyController {
  constructor(private vocabularyContract: VocabularyContract) {}

  @Get()
  async list(
    @CurrentUserId() userId: string,
    @Query("status") status?: string,
    @Query("topic") topic?: string,
    @Query("lessonId") lessonId?: string,
    @Query("offset") rawOffset?: string,
    @Query("limit") rawLimit?: string,
  ) {
    const offset = Math.max(0, Number(rawOffset) || 0);
    const limit = Math.min(100, Math.max(1, Number(rawLimit) || 50));
    const filters = {
      ...(status ? { status } : {}),
      ...(topic ? { topic } : {}),
      ...(lessonId ? { lessonId } : {}),
    };
    return this.vocabularyContract.findByUser(userId, filters, offset, limit);
  }

  @Get("stats")
  async stats(@CurrentUserId() userId: string) {
    return this.vocabularyContract.getStats(userId);
  }

  @Get("topics")
  async topics(@CurrentUserId() userId: string) {
    return this.vocabularyContract.getTopics(userId);
  }

  @Delete(":id")
  async remove(@CurrentUserId() userId: string, @Param("id") id: string) {
    const deleted = await this.vocabularyContract.deleteById(id, userId);
    if (!deleted) throw new NotFoundException("Word not found");
    return { success: true };
  }
}
