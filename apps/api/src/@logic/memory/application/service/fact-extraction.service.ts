import { Injectable } from "@nestjs/common";
import { FactExtractionResultSchema, type FactExtractionResult } from "@jake/shared";
import { LlmProvider } from "@lib/provider/src";
import type { LlmMessage } from "@lib/provider/src";
import { MemoryFactRepository } from "../../infrastructure/repository/memory-fact.repository";

const TEMPORARY_FACT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const FACT_EXTRACTION_PROMPT = `
Analyze the student's message in the context of the conversation.
Extract any NEW personal facts, errors, mood, and level signals.

IMPORTANT — what to extract and what NOT to extract:
- ONLY extract facts that will be relevant in FUTURE lessons (days/weeks/months later).
- DO NOT extract momentary states, current mood, or fleeting situations. These are useless later.
- Mark "isTemporary": true ONLY for facts that are relevant for a few days (e.g. "on vacation this week", "preparing for an exam on Friday").
- Mark "isTemporary": false for lasting facts about the person.

SKIP entirely (do NOT add to facts[]):
"just woke up", "is eating lunch", "feeling tired", "has a headache", "is at work right now", "just finished exercising", "is bored today".

EXTRACT as permanent (isTemporary: false):
"lives in Berlin", "works as a developer", "has a dog named Max", "likes rock music", "studies at university".

EXTRACT as temporary (isTemporary: true):
"is on vacation this week", "has an exam on Friday", "is moving to a new apartment next week".

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
