import { Injectable } from "@nestjs/common";
import { AnthropicLlmProvider, LlmMessage } from "../../../llm/src/anthropic-llm.provider";
import { ExerciseParserService } from "./exercise-parser.service";

@Injectable()
export class LessonResponseService {
  constructor(
    private llm: AnthropicLlmProvider,
    private exerciseParser: ExerciseParserService,
  ) {}

  async generate(
    systemPrompt: string,
    history: LlmMessage[],
  ) {
    const response = await this.llm.generate(systemPrompt, history);
    const exercise = this.exerciseParser.extract(response.text);
    const cleanText = this.exerciseParser.removeExerciseTags(response.text);

    return { text: cleanText, exercise, tokens: response };
  }
}
