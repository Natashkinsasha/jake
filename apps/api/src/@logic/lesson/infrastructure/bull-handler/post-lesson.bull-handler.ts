import { type PostLessonLlmResponse, PostLessonLlmResponseSchema } from "@jake/shared";
import type { EmbeddingProvider, LlmProvider } from "@lib/provider/src";
import { Processor } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { ClsWorkerHost } from "@shared/shared-cls/cls-worker-host";
import { Transaction } from "@shared/shared-cls/transaction";
import { QUEUE_NAMES } from "@shared/shared-job/queue-names";
import type { Job } from "bullmq";
import type { ClsService } from "nestjs-cls";
import type { AuthContract } from "../../../auth/contract/auth.contract";
import type { MemoryContract } from "../../../memory/contract/memory.contract";
import type { ProgressContract } from "../../../progress/contract/progress.contract";
import type { VocabularyContract } from "../../../vocabulary/contract/vocabulary.contract";
import type { LessonRepository } from "../repository/lesson.repository";

const SUMMARY_PROMPT = `Analyze the full lesson conversation and generate a structured summary.
Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary",
  "topics": ["Human-readable topic names, e.g. Present Tense, Food Vocabulary, Travel Phrases"],
  "newWords": [{"word": "reluctant", "translation": "неохотный", "topic": "emotions"}],
  "reviewedWords": ["words the student successfully recalled or used correctly from previous lessons"],
  "errorsFound": [{"text": "error", "correction": "correct", "topic": "topic"}],
  "emotionalSummary": "student mood description",
  "levelAssessment": "A1|A2|B1|B2|C1|C2 or null",
  "suggestedNextTopics": ["topics"]
}

IMPORTANT for newWords:
- Include the translation in the student's native language (shown in conversation context)
- Translation MUST be a real word — NEVER use "<UNKNOWN>", "unknown", or empty strings. If unsure, skip the word.
- Assign a topic category (e.g. "emotions", "travel", "food", "business", "daily life", "grammar")
- Only include words that were NEW to the student or that they asked about
- Do NOT include common/basic words the student clearly already knows

IMPORTANT for reviewedWords:
- Include words the student successfully used or translated from their existing vocabulary
- Only count it if the student demonstrated knowledge (not just heard the word)`;

@Processor(QUEUE_NAMES.POST_LESSON)
export class PostLessonBullHandler extends ClsWorkerHost {
  private readonly logger = new Logger(PostLessonBullHandler.name);

  constructor(
    protected readonly cls: ClsService,
    private llm: LlmProvider,
    private embeddingProvider: EmbeddingProvider,
    private lessonRepository: LessonRepository,
    private authContract: AuthContract,
    private vocabularyContract: VocabularyContract,
    private progressContract: ProgressContract,
    private memoryContract: MemoryContract,
  ) {
    super();
  }

  async processJob(job: Job<{ lessonId: string; conversationHistory: Array<{ role: string; content: string }> }>) {
    const { lessonId, conversationHistory } = job.data;
    this.logger.log(`Processing post-lesson job for lesson ${lessonId}`);

    try {
      const lesson = await this.lessonRepository.findById(lessonId);
      if (!lesson) {
        this.logger.warn(`Lesson ${lessonId} not found, skipping`);
        return;
      }

      const summary = await this.summarizeLesson(conversationHistory);

      await this.savePostLessonData(lessonId, lesson, summary);

      this.logger.log(`Post-lesson job completed for lesson ${lessonId}`);
    } catch (error) {
      this.logger.error(
        `Post-lesson job failed for lesson ${lessonId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Transaction()
  private async savePostLessonData(
    lessonId: string,
    lesson: { startedAt: Date; userId: string },
    summary: PostLessonLlmResponse,
  ) {
    await this.lessonRepository.complete(lessonId, {
      summary: summary.summary,
      topics: summary.topics,
      newWords: summary.newWords.map((w) => w.word),
      errorsFound: summary.errorsFound,
      levelAssessment: summary.levelAssessment,
      durationMinutes: Math.max(1, Math.round((Date.now() - lesson.startedAt.getTime()) / 60000)),
    });

    if (summary.levelAssessment) {
      await this.authContract.updateLevel(lesson.userId, summary.levelAssessment);
    }

    if (summary.emotionalSummary) {
      const embedding = await this.embeddingProvider.embed(summary.emotionalSummary);
      await this.memoryContract.createEmbedding({
        userId: lesson.userId,
        lessonId,
        content: summary.emotionalSummary,
        embedding,
        emotionalTone: "neutral",
      });
    }

    for (const wordEntry of summary.newWords) {
      await this.vocabularyContract.upsert({
        userId: lesson.userId,
        word: wordEntry.word,
        translation: wordEntry.translation,
        topic: wordEntry.topic,
        lessonId,
      });
    }

    if (summary.reviewedWords.length > 0) {
      await this.vocabularyContract.incrementReview(lesson.userId, summary.reviewedWords);
    }

    for (const error of summary.errorsFound) {
      await this.progressContract.upsertError(lesson.userId, error.topic);
    }
  }

  private async summarizeLesson(
    conversationHistory: Array<{ role: string; content: string }>,
  ): Promise<PostLessonLlmResponse> {
    const historyText = conversationHistory.map((m) => `${m.role}: ${m.content}`).join("\n");

    return this.llm.generateJson(
      SUMMARY_PROMPT,
      [{ role: "user", content: historyText }],
      PostLessonLlmResponseSchema,
      undefined,
      "post-lesson.summary",
    );
  }
}
