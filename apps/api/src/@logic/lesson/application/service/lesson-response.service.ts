import type { LlmMessage, LlmProvider } from "@lib/provider/src";
import { Injectable } from "@nestjs/common";

@Injectable()
export class LessonResponseService {
  constructor(private llm: LlmProvider) {}

  async generate(systemPrompt: string, history: LlmMessage[], spanName = "lesson.response") {
    const response = await this.llm.generate(systemPrompt, history, undefined, spanName);

    return { text: response.text, tokens: response };
  }
}
