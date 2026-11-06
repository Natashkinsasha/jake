import { type PostLessonLlmResponse, PostLessonLlmResponseSchema } from "@jake/shared";
import { EmbeddingProvider, LlmProvider } from "@lib/provider/src";
import { Processor } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { ClsWorkerHost } from "@shared/shared-cls/cls-worker-host";
import { Transaction } from "@shared/shared-cls/transaction";
import { QUEUE_NAMES } from "@shared/shared-job/queue-names";
import type { Job } from "bullmq";
import { ClsService } from "nestjs-cls";
import { AuthContract } from "../../../auth/contract/auth.contract";
import { MemoryContract } from "../../../memory/contract/memory.contract";
import { ProgressContract } from "../../../progress/contract/progress.contract";
import { VocabularyContract } from "../../../vocabulary/contract/vocabulary.contract";
import { LessonRepository } from "../repository/lesson.repository";
import { SUMMARY_PROMPT } from "./post-lesson.prompt";

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
      durationMinutes: Math.max(1, Math.round((Date.now() - lesson.startedAt.getTime()) / 60_000)),
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
      { spanName: "post-lesson.summary" },
    );
  }
}
