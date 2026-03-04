import { Injectable, Logger } from "@nestjs/common";
import { LessonRepository } from "../../infrastructure/repository/lesson.repository";
import { LessonMessageRepository } from "../../infrastructure/repository/lesson-message.repository";
import { LessonContextService } from "../service/lesson-context.service";
import { LessonResponseService } from "../service/lesson-response.service";
import { AudioPipelineService } from "../service/audio-pipeline.service";
import { StreamingPipelineService } from "../service/streaming-pipeline.service";
import type { StreamCallbacks } from "../service/streaming-pipeline.service";
import { TtsProvider } from "../../../../@lib/provider/src";
import type { LlmMessage } from "../../../../@lib/provider/src";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { buildFullSystemPrompt } from "../service/prompt-builder";
import { QUEUE_NAMES } from "../../../../@shared/shared-job/queue-names";

export function toSpeechSpeed(pref: string): number {
  switch (pref) {
    case "slow": return 0.85;
    case "fast": return 1.2;
    default: return 1.0;
  }
}

const GREETING_PROMPTS = [
  "Greet the student casually, like a mate you haven't seen in a bit. Keep it to one short sentence.",
  "Say hi with a quick question about their day. One sentence max.",
  "Start with a fun, light comment and ask what they want to chat about today. Keep it super short.",
  "Give a chill Aussie greeting and ask how they're going. One sentence.",
  "Welcome them back with energy. Maybe reference something fun. Keep it brief — one sentence.",
];

function pickGreetingPrompt(): string {
  return GREETING_PROMPTS[Math.floor(Math.random() * GREETING_PROMPTS.length)] ?? GREETING_PROMPTS[0] ?? "";
}

@Injectable()
export class LessonMaintainer {
  private readonly logger = new Logger(LessonMaintainer.name);

  constructor(
    private lessonRepository: LessonRepository,
    private messageRepository: LessonMessageRepository,
    private contextService: LessonContextService,
    private responseService: LessonResponseService,
    private audioPipeline: AudioPipelineService,
    private streamingPipeline: StreamingPipelineService,
    private tts: TtsProvider,
    @InjectQueue(QUEUE_NAMES.POST_LESSON) private postLessonQueue: Queue,
    @InjectQueue(QUEUE_NAMES.FACT_EXTRACTION) private factQueue: Queue,
  ) {}

  async getLesson(lessonId: string) {
    const lesson = await this.lessonRepository.findById(lessonId);
    if (!lesson) return null;
    const messages = await this.messageRepository.findByLesson(lessonId);
    return {
      id: lesson.id,
      status: lesson.status,
      topic: lesson.topics != null && lesson.topics.length > 0 ? lesson.topics.join(", ") : null,
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
    const lessons = await this.lessonRepository.findRecentByUser(userId);
    return lessons.map((l) => ({
      id: l.id,
      status: l.status,
      topic: l.topics != null && l.topics.length > 0 ? l.topics.join(", ") : null,
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

    const lesson = await this.lessonRepository.createWithGreeting(
      {
        userId,
        tutorId: context.tutorId,
        lessonNumber: context.lessonNumber,
      },
      greeting.text,
    );

    const speechSpeed = toSpeechSpeed(context.preferences.speakingSpeed);

    let greetingAudio = "";
    try {
      greetingAudio = await this.tts.synthesize(
        greeting.text,
        context.tutorVoiceId,
        speechSpeed,
      );
    } catch (error) {
      this.logger.warn(`TTS failed for greeting, sending text only: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      lessonId: lesson.id,
      systemPrompt,
      voiceId: context.tutorVoiceId,
      speechSpeed,
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
    speechSpeed?: number,
  ) {
    const result = await this.audioPipeline.processAudio(
      audioBase64,
      systemPrompt,
      history,
      voiceId,
      speechSpeed,
    );

    await this.messageRepository.create({
      lessonId,
      role: "user",
      content: result.transcript,
    });
    await this.messageRepository.create({
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
    speechSpeed?: number,
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
      tutorAudio = await this.tts.synthesize(response.text, voiceId, speechSpeed);
    } catch (error) {
      this.logger.warn(`TTS failed, sending text only: ${error instanceof Error ? error.message : String(error)}`);
    }

    await this.messageRepository.create({ lessonId, role: "user", content: text });
    await this.messageRepository.create({
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

  async processTextMessageStreaming(
    lessonId: string,
    userId: string,
    text: string,
    systemPrompt: string,
    history: LlmMessage[],
    voiceId: string,
    callbacks: StreamCallbacks,
    options?: { speechSpeed?: number; signal?: AbortSignal },
  ) {
    const updatedHistory: LlmMessage[] = [
      ...history,
      { role: "user", content: text },
    ];

    await this.streamingPipeline.stream(
      systemPrompt,
      updatedHistory,
      voiceId,
      {
        onChunk: (chunk) => { callbacks.onChunk(chunk); },
        onEnd: (result) => {
          void (async () => {
            await this.messageRepository.create({ lessonId, role: "user", content: text });
            await this.messageRepository.create({ lessonId, role: "tutor", content: result.fullText });

            await this.factQueue.add("extract", {
              userId,
              lessonId,
              userMessage: text,
              history: updatedHistory,
            });

            callbacks.onEnd(result);
          })();
        },
        onError: (error) => { callbacks.onError(error); },
      },
      { speechSpeed: options?.speechSpeed, signal: options?.signal },
    );
  }

  async endLesson(lessonId: string, history: LlmMessage[]) {
    await this.lessonRepository.complete(lessonId, {});

    await this.postLessonQueue.add("process", {
      lessonId,
      conversationHistory: history,
    });
  }
}
