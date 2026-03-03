import { Injectable, Logger } from "@nestjs/common";
import { LessonDao } from "../../infrastructure/dao/lesson.dao";
import { LessonMessageDao } from "../../infrastructure/dao/lesson-message.dao";
import { LessonRepository } from "../../infrastructure/repository/lesson.repository";
import { LessonContextService } from "../service/lesson-context.service";
import { LessonResponseService } from "../service/lesson-response.service";
import { AudioPipelineService } from "../service/audio-pipeline.service";
import { LlmMessage } from "../../../../@lib/llm/src/llm.service";
import { TtsService } from "../../../../@lib/voice/src/tts.service";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { buildFullSystemPrompt } from "../service/prompt-builder";
import { QUEUE_NAMES } from "../../../../@shared/shared-job/queue-names";

const GREETING_PROMPTS = [
  "Greet the student casually, like a mate you haven't seen in a bit. Keep it to one short sentence.",
  "Say hi with a quick question about their day. One sentence max.",
  "Start with a fun, light comment and ask what they want to chat about today. Keep it super short.",
  "Give a chill Aussie greeting and ask how they're going. One sentence.",
  "Welcome them back with energy. Maybe reference something fun. Keep it brief — one sentence.",
];

function pickGreetingPrompt(): string {
  return GREETING_PROMPTS[Math.floor(Math.random() * GREETING_PROMPTS.length)];
}

@Injectable()
export class LessonMaintainer {
  private readonly logger = new Logger(LessonMaintainer.name);

  constructor(
    private lessonDao: LessonDao,
    private messageDao: LessonMessageDao,
    private lessonRepo: LessonRepository,
    private contextService: LessonContextService,
    private responseService: LessonResponseService,
    private audioPipeline: AudioPipelineService,
    private tts: TtsService,
    @InjectQueue(QUEUE_NAMES.POST_LESSON) private postLessonQueue: Queue,
    @InjectQueue(QUEUE_NAMES.FACT_EXTRACTION) private factQueue: Queue,
  ) {}

  async getLesson(lessonId: string) {
    const lesson = await this.lessonDao.findById(lessonId);
    if (!lesson) return null;
    const messages = await this.messageDao.findByLesson(lessonId);
    return {
      id: lesson.id,
      status: lesson.status,
      topic: (lesson.topics as string[] | null)?.length ? (lesson.topics as string[]).join(", ") : null,
      createdAt: lesson.startedAt,
      duration: lesson.durationMinutes,
      summary: lesson.summary,
      lessonNumber: lesson.lessonNumber,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
    };
  }

  async listLessons(userId: string) {
    const lessons = await this.lessonDao.findRecentByUser(userId);
    return lessons.map((l) => ({
      id: l.id,
      status: l.status,
      topic: l.topics?.length ? l.topics.join(", ") : null,
      createdAt: l.startedAt,
      duration: l.durationMinutes,
      summary: l.summary,
      lessonNumber: l.lessonNumber,
    }));
  }

  async startLesson(userId: string) {
    const context = await this.contextService.build(userId);

    const systemPrompt = buildFullSystemPrompt(context);

    const greeting = await this.responseService.generate(systemPrompt, [
      { role: "user", content: pickGreetingPrompt() },
    ]);

    const lesson = await this.lessonRepo.createWithGreeting(
      {
        userId,
        tutorId: context.tutorId,
        lessonNumber: context.lessonNumber,
      },
      greeting.text,
    );

    let greetingAudio = "";
    try {
      greetingAudio = await this.tts.synthesize(
        greeting.text,
        context.tutorVoiceId,
      );
    } catch (error) {
      this.logger.warn(`TTS failed for greeting, sending text only: ${error instanceof Error ? error.message : error}`);
    }

    return {
      lessonId: lesson.id,
      systemPrompt,
      voiceId: context.tutorVoiceId,
      greeting: { text: greeting.text, audio: greetingAudio, exercise: greeting.exercise },
    };
  }

  async processUserAudio(
    lessonId: string,
    userId: string,
    audioBase64: string,
    systemPrompt: string,
    history: LlmMessage[],
    voiceId: string,
  ) {
    const result = await this.audioPipeline.processAudio(
      audioBase64,
      systemPrompt,
      history,
      voiceId,
    );

    await this.messageDao.create({
      lessonId,
      role: "user",
      content: result.transcript,
    });
    await this.messageDao.create({
      lessonId,
      role: "tutor",
      content: result.tutorText,
    });

    await this.factQueue.add("extract", {
      userId,
      lessonId,
      userMessage: result.transcript,
      history: [...history, { role: "user", content: result.transcript }],
    });

    return result;
  }

  async processTextMessage(
    lessonId: string,
    userId: string,
    text: string,
    systemPrompt: string,
    history: LlmMessage[],
    voiceId: string,
  ) {
    const updatedHistory: LlmMessage[] = [
      ...history,
      { role: "user", content: text },
    ];

    const response = await this.responseService.generate(
      systemPrompt,
      updatedHistory,
    );

    let tutorAudio = "";
    try {
      tutorAudio = await this.tts.synthesize(response.text, voiceId);
    } catch (error) {
      this.logger.warn(`TTS failed, sending text only: ${error instanceof Error ? error.message : error}`);
    }

    await this.messageDao.create({ lessonId, role: "user", content: text });
    await this.messageDao.create({
      lessonId,
      role: "tutor",
      content: response.text,
    });

    await this.factQueue.add("extract", {
      userId,
      lessonId,
      userMessage: text,
      history: updatedHistory,
    });

    return {
      tutorText: response.text,
      tutorAudio: tutorAudio,
      exercise: response.exercise,
    };
  }

  async endLesson(lessonId: string, history: LlmMessage[]) {
    await this.lessonDao.complete(lessonId, {});

    await this.postLessonQueue.add("process", {
      lessonId,
      conversationHistory: history,
    });
  }
}
