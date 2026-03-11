import { Injectable } from "@nestjs/common";
import type { SelectLesson } from "../../infrastructure/model/select-lesson";
import type { LessonSummaryResponse } from "../../presentation/dto/response/lesson-summary.response";

@Injectable()
export class LessonMapper {
  toSummaryResponse(lesson: SelectLesson): LessonSummaryResponse {
    return {
      id: lesson.id,
      status: lesson.status,
      startedAt: lesson.startedAt.toISOString(),
      endedAt: lesson.endedAt?.toISOString() ?? null,
      durationMinutes: lesson.durationMinutes,
      summary: lesson.summary,
      topics: (lesson.topics ?? []) as string[],
      newWords: (lesson.newWords ?? []) as string[],
    };
  }
}
