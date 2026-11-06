import { type FactExtractionResult, FactExtractionResultSchema } from "@jake/shared";
import { type LlmMessage, LlmProvider } from "@lib/provider/src";
import { Injectable } from "@nestjs/common";
import { MemoryFactRepository } from "../../infrastructure/repository/memory-fact.repository";
import { FACT_EXTRACTION_PROMPT } from "./fact-extraction.prompt";

const TEMPORARY_FACT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class FactExtractionService {
  constructor(
    private llm: LlmProvider,
    private factRepository: MemoryFactRepository,
  ) {}

  async extractAndSave(userId: string, lessonId: string, userMessage: string, history: LlmMessage[]) {
    const result = await this.llm.generateJson<FactExtractionResult>(
      FACT_EXTRACTION_PROMPT,
      [...history, { role: "user", content: userMessage }],
      FactExtractionResultSchema,
      { spanName: "memory.fact-extraction" },
    );

    for (const fact of result.facts) {
      await this.factRepository.create({
        userId,
        category: fact.category,
        fact: fact.fact,
        source: lessonId,
        expiresAt: fact.isTemporary ? new Date(Date.now() + TEMPORARY_FACT_TTL_MS) : null,
      });
    }

    return result;
  }
}
