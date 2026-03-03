import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Transaction } from "../../../../@shared/shared-cls/transaction";
import { LlmService } from "../../../../@lib/llm/src/llm.service";
import { EmbeddingService } from "../../../../@lib/embedding/src/embedding.service";
import { LessonDao } from "../dao/lesson.dao";
import { UserDao } from "../../../auth/infrastructure/dao/user.dao";
import { VocabularyDao } from "../../../vocabulary/infrastructure/dao/vocabulary.dao";
import { GrammarProgressDao } from "../../../progress/infrastructure/dao/grammar-progress.dao";
import { MemoryEmbeddingDao } from "../../../memory/infrastructure/dao/memory-embedding.dao";
import { HomeworkGeneratorService } from "../../../homework/application/service/homework-generator.service";
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
    private lessonDao: LessonDao,
    private userDao: UserDao,
    private vocabDao: VocabularyDao,
    private grammarDao: GrammarProgressDao,
    private embeddingDao: MemoryEmbeddingDao,
    private homeworkGenerator: HomeworkGeneratorService,
  ) {
    super();
  }

  async process(job: Job) {
    const { lessonId, conversationHistory } = job.data;
    this.logger.log(`Processing post-lesson job for lesson ${lessonId}`);

    try {
      const lesson = await this.lessonDao.findById(lessonId);
      if (!lesson) {
        this.logger.warn(`Lesson ${lessonId} not found, skipping`);
        return;
      }

      const summary = await this.summarizeLesson(conversationHistory);

      await this.savePostLessonData(lessonId, lesson, summary);

      // Homework generation outside transaction — can fail independently
      const user = await this.userDao.findByIdWithPreferences(lesson.userId);
      await this.homeworkGenerator.generateAndSave(
        lessonId,
        lesson.userId,
        summary,
        (user?.user_preferences || {}) as any,
      );

      this.logger.log(`Post-lesson job completed for lesson ${lessonId}`);
    } catch (error) {
      this.logger.error(
        `Post-lesson job failed for lesson ${lessonId}: ${error instanceof Error ? error.message : error}`,
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
    await this.lessonDao.complete(lessonId, {
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
      await this.userDao.updateLevel(lesson.userId, summary.levelAssessment);
    }

    if (summary.emotionalSummary) {
      const embedding = await this.embeddingService.embed(summary.emotionalSummary);
      await this.embeddingDao.create({
        userId: lesson.userId,
        lessonId,
        content: summary.emotionalSummary,
        embedding,
        emotionalTone: "neutral",
      });
    }

    for (const word of summary.newWords || []) {
      await this.vocabDao.upsert({
        userId: lesson.userId,
        word,
        lessonId,
        strength: 10,
        nextReview: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    for (const error of summary.errorsFound || []) {
      await this.grammarDao.upsertError(lesson.userId, error.topic);
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
