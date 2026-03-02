import { Injectable } from "@nestjs/common";
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

@Injectable()
export class LessonMaintainer {
  constructor(
    private lessonDao: LessonDao,
    private messageDao: LessonMessageDao,
    private lessonRepo: LessonRepository,
    private contextService: LessonContextService,
    private responseService: LessonResponseService,
    private audioPipeline: AudioPipelineService,
    private tts: TtsService,
    @InjectQueue("post-lesson") private postLessonQueue: Queue,
    @InjectQueue("fact-extraction") private factQueue: Queue,
  ) {}

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
      { role: "user", content: "Start the lesson with a warm greeting." },
    ]);

    const lesson = await this.lessonRepo.createWithGreeting(
      {
        userId,
        tutorId: context.tutorId,
        lessonNumber: context.lessonNumber,
      },
      greeting.text,
    );

    const greetingAudio = await this.tts.synthesize(
      greeting.text,
      context.tutorVoiceId,
    );

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

    const tutorAudio = await this.tts.synthesize(response.text, voiceId);

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
