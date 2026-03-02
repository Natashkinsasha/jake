import { Injectable } from "@nestjs/common";
import { SelectHomework } from "../../infrastructure/model/select-homework";
import { HomeworkDetailResponse } from "../../presentation/dto/response/homework-detail.response";

@Injectable()
export class HomeworkMapper {
  toResponse(homework: SelectHomework): HomeworkDetailResponse {
    return {
      id: homework.id,
      lessonId: homework.lessonId,
      exercises: (homework.exercises ?? []) as Record<string, unknown>[],
      createdAt: homework.createdAt.toISOString(),
      dueAt: homework.dueAt?.toISOString() ?? null,
      completedAt: homework.completedAt?.toISOString() ?? null,
      score: homework.score,
    };
  }
}
