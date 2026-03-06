import { Injectable } from "@nestjs/common";
import { FactExtractionResultSchema, type FactExtractionResult } from "@jake/shared";
import { LlmProvider } from "@lib/provider/src";
import type { LlmMessage } from "@lib/provider/src";
import { MemoryFactRepository } from "../../infrastructure/repository/memory-fact.repository";

const TEMPORARY_FACT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const FACT_EXTRACTION_PROMPT = `
Analyze the student's message in the context of the conversation.
Extract any NEW personal facts, errors, mood, and level signals.

IMPORTANT: Mark facts as "isTemporary": true if they describe a current state, mood, or situation that will likely change within hours or days.
Examples of TEMPORARY facts: "just woke up", "is eating lunch", "is at the airport", "feeling tired today", "has a headache", "is on vacation this week".
Examples of PERMANENT facts: "lives in Berlin", "works as a developer", "has a dog named Max", "likes rock music", "studies at university".

Return ONLY valid JSON:
{
  "facts": [{"category": "personal|work|hobby|family|travel|education|other", "fact": "Short statement", "isTemporary": false}],
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
      FactExtractionResultSchema,
      undefined,
      "memory.fact-extraction",
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
