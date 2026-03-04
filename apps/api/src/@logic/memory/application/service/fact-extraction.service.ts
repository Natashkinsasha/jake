import { Injectable } from "@nestjs/common";
import { LlmProvider } from "../../../../@lib/provider/src";
import type { LlmMessage } from "../../../../@lib/provider/src";
import { MemoryFactRepository } from "../../infrastructure/repository/memory-fact.repository";
import { FactExtractionResultSchema, type FactExtractionResult } from "@jake/shared";

const FACT_EXTRACTION_PROMPT = `
Analyze the student's message in the context of the conversation.
Extract any NEW personal facts, errors, mood, and level signals.

Return ONLY valid JSON:
{
  "facts": [{"category": "personal|work|hobby|family|travel|education|other", "fact": "Short statement"}],
  "errors": [{"text": "wrong text", "correction": "correct version", "topic": "grammar_topic"}],
  "mood": "happy|excited|neutral|tired|sad|frustrated|anxious",
  "levelSignals": "Brief note or null"
}
`;

@Injectable()
export class FactExtractionService {
  constructor(
    private llm: LlmProvider,
    private factRepository: MemoryFactRepository,
  ) {}

  async extractAndSave(
    userId: string,
    lessonId: string,
    userMessage: string,
    history: LlmMessage[],
  ) {
    const result = await this.llm.generateJson<FactExtractionResult>(
      FACT_EXTRACTION_PROMPT,
      [...history, { role: "user", content: userMessage }],
    );

    const parsed = FactExtractionResultSchema.safeParse(result);
    if (!parsed.success) return null;

    for (const fact of parsed.data.facts) {
      await this.factRepository.create({
        userId,
        category: fact.category,
        fact: fact.fact,
        source: lessonId,
      });
    }

    return parsed.data;
  }
}
