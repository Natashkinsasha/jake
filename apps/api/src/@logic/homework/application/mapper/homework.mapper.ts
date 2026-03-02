import { Injectable } from "@nestjs/common";
import { HomeworkDetailResponse } from "../../presentation/dto/response/homework-detail.response";

@Injectable()
export class HomeworkMapper {
  toResponse(homework: any): HomeworkDetailResponse {
    return {
      id: homework.id,
      lessonId: homework.lessonId,
      exercises: homework.exercises,
      createdAt: homework.createdAt.toISOString(),
      dueAt: homework.dueAt?.toISOString() ?? null,
      completedAt: homework.completedAt?.toISOString() ?? null,
      score: homework.score,
    };
  }
}
