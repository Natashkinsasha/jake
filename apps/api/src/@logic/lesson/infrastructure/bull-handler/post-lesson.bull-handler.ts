import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { LlmService } from "../../../../@lib/llm/src/llm.service";
import { EmbeddingService } from "../../../../@lib/embedding/src/embedding.service";
import { LessonDao } from "../dao/lesson.dao";
import { UserDao } from "../../../auth/infrastructure/dao/user.dao";
import { VocabularyDao } from "../../../vocabulary/infrastructure/dao/vocabulary.dao";
import { GrammarProgressDao } from "../../../progress/infrastructure/dao/grammar-progress.dao";
import { MemoryEmbeddingDao } from "../../../memory/infrastructure/dao/memory-embedding.dao";
import { HomeworkGeneratorService } from "../../../homework/application/service/homework-generator.service";

interface PostLessonSummary {
  summary: string;
  topics: string[];
  newWords: string[];
  errorsFound: Array<{ text: string; correction: string; topic: string }>;
  emotionalSummary: string | null;
  levelAssessment: string | null;
  suggestedNextTopics: string[];
}

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

@Processor("post-lesson")
export class PostLessonBullHandler extends WorkerHost {
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

    const lesson = await this.lessonDao.findById(lessonId);
    if (!lesson) return;

    const historyText = conversationHistory
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join("\n");

    const summary = await this.llm.generateJson<PostLessonSummary>(
      SUMMARY_PROMPT,
      [{ role: "user", content: historyText }],
    );

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

    const user = await this.userDao.findByIdWithPreferences(lesson.userId);
    await this.homeworkGenerator.generateAndSave(
      lessonId,
      lesson.userId,
      summary,
      (user?.user_preferences || {}) as any,
    );
  }
}
