import { Injectable } from "@nestjs/common";
import { LlmProvider } from "../../../../@lib/provider/src";
import type { LlmMessage } from "../../../../@lib/provider/src";
import { ExerciseParserService } from "./exercise-parser.service";

@Injectable()
export class LessonResponseService {
  constructor(
    private llm: LlmProvider,
    private exerciseParser: ExerciseParserService,
  ) {}

  async generate(
    systemPrompt: string,
    history: LlmMessage[],
    spanName = "lesson.response",
  ) {
    const response = await this.llm.generate(systemPrompt, history, undefined, spanName);
    const exercise = this.exerciseParser.extract(response.text);
    const cleanText = this.exerciseParser.removeExerciseTags(response.text);

    return { text: cleanText, exercise, tokens: response };
  }
}
