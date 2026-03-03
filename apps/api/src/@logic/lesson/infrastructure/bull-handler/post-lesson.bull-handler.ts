import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Transaction } from "../../../../@shared/shared-cls/transaction";
import { LlmService } from "../../../../@lib/llm/src/llm.service";
import { EmbeddingService } from "../../../../@lib/embedding/src/embedding.service";
import { LessonRepository } from "../repository/lesson.repository";
import { AuthContract } from "../../../auth/contract/auth.contract";
import { MemoryContract } from "../../../memory/contract/memory.contract";
import { PostLessonLlmResponseSchema, PostLessonLlmResponse } from "@jake/shared";
import { QUEUE_NAMES } from "../../../../@shared/shared-job/queue-names";

const SUMMARY_PROMPT = `Analyze the full lesson conversation and generate a structured summary.
Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary",
  "topics": ["grammar_topics"],
  "newWords": ["vocabulary"],
  "errorsFound": [{"text": "error", "correction": "correct", "topic": "topic"}],
  "emotionalSummary": "student mood description",
  "levelAssessment": "A1|A2|B1|B2|C1|C2 or null",
  "suggestedNextTopics": ["topics"]
}`;

@Processor(QUEUE_NAMES.POST_LESSON)
export class PostLessonBullHandler extends WorkerHost {
  private readonly logger = new Logger(PostLessonBullHandler.name);

  constructor(
    private llm: LlmService,
    private embeddingService: EmbeddingService,
    private lessonRepository: LessonRepository,
    private authContract: AuthContract,
    private memoryContract: MemoryContract,
  ) {
    super();
  }

  async process(job: Job<{ lessonId: string; conversationHistory: Array<{ role: string; content: string }> }>) {
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
      newWords: summary.newWords,
      errorsFound: summary.errorsFound,
      levelAssessment: summary.levelAssessment,
      durationMinutes: Math.max(1, Math.round(
        (Date.now() - lesson.startedAt.getTime()) / 60000,
      )),
    });

    if (summary.levelAssessment) {
      await this.authContract.updateLevel(lesson.userId, summary.levelAssessment);
    }

    if (summary.emotionalSummary) {
      const embedding = await this.embeddingService.embed(summary.emotionalSummary);
      await this.memoryContract.createEmbedding({
        userId: lesson.userId,
        lessonId,
        content: summary.emotionalSummary,
        embedding,
        emotionalTone: "neutral",
      });
    }

  }

  private async summarizeLesson(conversationHistory: Array<{ role: string; content: string }>): Promise<PostLessonLlmResponse> {
    const historyText = conversationHistory
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    return this.llm.generateJson(
      SUMMARY_PROMPT,
      [{ role: "user", content: historyText }],
      undefined,
      PostLessonLlmResponseSchema,
    );
  }
}
