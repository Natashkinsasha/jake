import { Injectable } from "@nestjs/common";
import { LlmProvider } from "@lib/provider/src";
import type { LlmMessage } from "@lib/provider/src";

@Injectable()
export class LessonResponseService {
  constructor(private llm: LlmProvider) {}

  async generate(
    systemPrompt: string,
    history: LlmMessage[],
    spanName = "lesson.response",
  ) {
    const response = await this.llm.generate(systemPrompt, history, undefined, spanName);

    return { text: response.text, tokens: response };
  }
}
