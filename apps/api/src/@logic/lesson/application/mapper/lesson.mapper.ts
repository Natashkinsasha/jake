import { Injectable } from "@nestjs/common";
import { SelectLesson } from "../../infrastructure/model/select-lesson";
import { LessonSummaryResponse } from "../../presentation/dto/response/lesson-summary.response";

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
