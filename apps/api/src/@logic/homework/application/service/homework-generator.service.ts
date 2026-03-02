import { Injectable } from "@nestjs/common";
import { LlmService } from "../../../../@lib/llm/src/llm.service";
import { HomeworkDao } from "../../infrastructure/dao/homework.dao";

interface LessonSummary {
  levelAssessment: string | null;
  errorsFound: Array<{ text: string; correction: string; topic: string }>;
  topics: string[];
  newWords: string[];
}

interface UserPreferences {
  preferredExerciseTypes?: string[];
  interests?: string[];
}

@Injectable()
export class HomeworkGeneratorService {
  constructor(
    private llm: LlmService,
    private homeworkDao: HomeworkDao,
  ) {}

  async generateAndSave(
    lessonId: string,
    userId: string,
    summary: LessonSummary,
    preferences: UserPreferences,
  ) {
    const prompt = `Generate homework exercises based on today's lesson.

Student level: ${summary.levelAssessment || "A2"}
Weak areas: ${summary.errorsFound?.map((e) => e.topic).join(", ")}
Topics covered: ${summary.topics?.join(", ")}
New words: ${summary.newWords?.join(", ")}
Student prefers: ${preferences.preferredExerciseTypes?.join(", ") || "no preference"}
Student interests: ${preferences.interests?.join(", ")}

Generate 5-7 exercises. Return ONLY valid JSON array:
[{
  "id": "hw_1",
  "type": "fill_the_gap|multiple_choice|sentence_builder|error_correction",
  "instruction": "string",
  "content": {},
  "correctAnswer": "string",
  "topic": "string",
  "difficulty": "easy|medium|hard"
}]

Make exercises fun and use the student's interests for context.`;

    const exercises = await this.llm.generateJson<any[]>(
      "You are an exercise generator. Return only JSON.",
      [{ role: "user", content: prompt }],
      4096,
    );

    await this.homeworkDao.create({
      userId,
      lessonId,
      exercises,
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    });
  }
}
