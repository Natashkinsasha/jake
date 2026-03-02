Jake — AI English Tutor
Подробная инструкция по разработке (NestJS Edition)

1. Обзор проекта
   Jake — голосовой AI-преподаватель английского языка. Урок — это живой разговор с дружелюбным тьютором, который запоминает всё о тебе, адаптируется под твой стиль и создаёт персонализированные упражнения.
   Ключевые фичи

Голосовые уроки в формате дружеской беседы
AI запоминает мелкие детали о ученике (факты, эмоции, прогресс)
Персоны преподавателей с разными голосами и характерами (MVP: Jake — весёлый австралиец)
Интерактивные упражнения внутри разговора
Автоматическая генерация домашки после урока
Определение уровня через естественный разговор (без тестов)
Ученик полностью контролирует формат, длину и темп урока

Финальный стек
КомпонентТехнологияФронтендNext.js 14+ (App Router), TypeScript, Tailwind CSSБэкендNestJS + Fastify, TypeScriptБДPostgreSQL + pgvectorORMDrizzle ORMВалидацияZodКэш / ОчередиRedis + BullMQСобытияKafka (между сервисами) + BullMQ (фоновые задачи)LLMClaude API (Anthropic) или OpenAI GPT-4oSTTDeepgram (речь → текст)TTSElevenLabs (текст → речь, выбор голосов)АвторизацияAuth.js (NextAuth) + Google OAuthТранзакцииCLS (AsyncLocalStorage) + @Transaction() декораторМонорепоTurborepoДеплойKubernetes (k8s)КонтейнеризацияDocker

2. Структура монорепо
   jake/
   ├── turbo.json
   ├── package.json
   ├── pnpm-workspace.yaml
   ├── .github/
   │   └── workflows/
   │       ├── ci.yml
   │       └── deploy.yml
   ├── packages/
   │   └── shared/                       # Общие Zod-схемы и типы
   │       ├── package.json
   │       ├── tsconfig.json
   │       └── src/
   │           ├── index.ts
   │           ├── schemas/
   │           │   ├── user.ts
   │           │   ├── lesson.ts
   │           │   ├── exercise.ts
   │           │   ├── homework.ts
   │           │   ├── tutor.ts
   │           │   └── memory.ts
   │           └── types/
   │               └── index.ts
   ├── apps/
   │   ├── web/                          # Next.js фронтенд
   │   │   ├── package.json
   │   │   ├── Dockerfile
   │   │   └── src/
   │   │       ├── app/
   │   │       │   ├── layout.tsx
   │   │       │   ├── page.tsx
   │   │       │   ├── (auth)/login/page.tsx
   │   │       │   ├── (app)/
   │   │       │   │   ├── layout.tsx
   │   │       │   │   ├── dashboard/page.tsx
   │   │       │   │   ├── lesson/page.tsx
   │   │       │   │   ├── lesson/[id]/page.tsx
   │   │       │   │   ├── homework/page.tsx
   │   │       │   │   ├── homework/[id]/page.tsx
   │   │       │   │   ├── vocabulary/page.tsx
   │   │       │   │   ├── progress/page.tsx
   │   │       │   │   └── settings/page.tsx
   │   │       │   └── api/auth/[...nextauth]/route.ts
   │   │       ├── components/
   │   │       │   ├── ui/
   │   │       │   ├── lesson/
   │   │       │   │   ├── LessonScreen.tsx
   │   │       │   │   ├── VoiceWave.tsx
   │   │       │   │   ├── TutorAvatar.tsx
   │   │       │   │   ├── ExerciseCard.tsx
   │   │       │   │   ├── FillTheGap.tsx
   │   │       │   │   ├── MultipleChoice.tsx
   │   │       │   │   ├── SentenceBuilder.tsx
   │   │       │   │   ├── ErrorCorrection.tsx
   │   │       │   │   └── ListeningBar.tsx
   │   │       │   ├── homework/
   │   │       │   ├── dashboard/
   │   │       │   └── layout/
   │   │       ├── hooks/
   │   │       │   ├── useVoiceRecorder.ts
   │   │       │   ├── useWebSocket.ts
   │   │       │   ├── useAudioPlayer.ts
   │   │       │   └── useLessonState.ts
   │   │       ├── lib/
   │   │       │   ├── api.ts
   │   │       │   ├── auth.ts
   │   │       │   └── websocket.ts
   │   │       └── styles/globals.css
   │   │
   │   └── api/                          # NestJS бэкенд
   │       ├── package.json
   │       ├── tsconfig.json
   │       ├── nest-cli.json
   │       ├── Dockerfile
   │       └── src/
   │           ├── main.ts
   │           ├── create-app.ts
   │           ├── app.module.ts
   │           │
   │           ├── @lib/                         # Низкоуровневые обёртки
   │           │   ├── job/src/
   │           │   │   ├── job.module.ts
   │           │   │   └── queue-registry.service.ts
   │           │   ├── job-board/src/
   │           │   │   └── job-board.module.ts
   │           │   ├── kafka/src/
   │           │   │   ├── kafka.module.ts
   │           │   │   ├── kafka-client.service.ts
   │           │   │   ├── kafka-producer.service.ts
   │           │   │   ├── base-kafka.consumer.ts
   │           │   │   └── kafka.types.ts
   │           │   ├── llm/src/
   │           │   │   ├── llm.module.ts
   │           │   │   ├── llm.service.ts          # Claude/OpenAI обёртка
   │           │   │   └── llm.types.ts
   │           │   ├── voice/src/
   │           │   │   ├── voice.module.ts
   │           │   │   ├── stt.service.ts           # Deepgram STT
   │           │   │   ├── tts.service.ts           # ElevenLabs TTS
   │           │   │   └── voice.types.ts
   │           │   └── embedding/src/
   │           │       ├── embedding.module.ts
   │           │       └── embedding.service.ts     # Генерация эмбеддингов
   │           │
   │           ├── @shared/                         # Конфигурируемые NestJS-модули
   │           │   ├── shared-config/
   │           │   │   ├── shared-config.module.ts
   │           │   │   ├── env.schema.ts            # Zod-валидация .env
   │           │   │   └── env.service.ts
   │           │   ├── shared-drizzle-pg/
   │           │   │   ├── shared-drizzle-pg.module.ts
   │           │   │   └── drizzle.provider.ts
   │           │   ├── shared-cls/
   │           │   │   ├── shared-cls.module.ts
   │           │   │   ├── app-drizzle-transaction-host.ts
   │           │   │   └── transaction.ts           # @Transaction() декоратор
   │           │   ├── shared-redis/
   │           │   │   ├── shared-redis.module.ts
   │           │   │   └── redis.provider.ts
   │           │   ├── shared-job/
   │           │   │   └── shared-job.module.ts
   │           │   ├── shared-kafka/
   │           │   │   └── shared-kafka.module.ts
   │           │   ├── shared-job-board/
   │           │   │   └── shared-job-board.module.ts
   │           │   ├── shared-zod-http/
   │           │   │   ├── shared-zod-http.module.ts
   │           │   │   ├── zod-validation.pipe.ts
   │           │   │   └── zod-exception.filter.ts
   │           │   └── shared-ws/
   │           │       ├── shared-ws.module.ts
   │           │       └── ws-auth.guard.ts         # WebSocket JWT guard
   │           │
   │           └── @logic/                          # Доменные модули
   │               ├── health/
   │               │   ├── health.module.ts
   │               │   ├── application/
   │               │   │   └── health.maintainer.ts
   │               │   ├── health-indicator/
   │               │   │   └── pg-health-indicator.service.ts
   │               │   └── presentation/
   │               │       └── health.controller.ts
   │               │
   │               ├── auth/
   │               │   ├── auth.module.ts
   │               │   ├── presentation/
   │               │   │   ├── controller/
   │               │   │   │   └── auth.controller.ts
   │               │   │   └── dto/
   │               │   │       ├── body/google-auth.body.ts
   │               │   │       └── response/auth-token.response.ts
   │               │   ├── application/
   │               │   │   ├── maintainer/auth.maintainer.ts
   │               │   │   └── service/jwt-token.service.ts
   │               │   └── infrastructure/
   │               │       ├── table/user.table.ts
   │               │       ├── table/user-preference.table.ts
   │               │       ├── model/insert-user.ts
   │               │       ├── model/select-user.ts
   │               │       ├── model/select-user-with-preferences.ts
   │               │       └── dao/user.dao.ts
   │               │
   │               ├── tutor/
   │               │   ├── tutor.module.ts
   │               │   ├── presentation/
   │               │   │   ├── controller/tutor.controller.ts
   │               │   │   └── dto/
   │               │   │       └── response/tutor-list.response.ts
   │               │   ├── application/
   │               │   │   ├── maintainer/tutor.maintainer.ts
   │               │   │   └── mapper/tutor.mapper.ts
   │               │   └── infrastructure/
   │               │       ├── table/tutor.table.ts
   │               │       ├── table/user-tutor.table.ts
   │               │       ├── model/select-tutor.ts
   │               │       ├── dao/tutor.dao.ts
   │               │       ├── dao/user-tutor.dao.ts
   │               │       └── migration/
   │               │
   │               ├── lesson/
   │               │   ├── lesson.module.ts
   │               │   ├── presentation/
   │               │   │   ├── controller/lesson.controller.ts
   │               │   │   ├── gateway/lesson.gateway.ts          # WebSocket Gateway
   │               │   │   └── dto/
   │               │   │       ├── body/end-lesson.body.ts
   │               │   │       ├── response/lesson-summary.response.ts
   │               │   │       └── ws/                             # WebSocket DTO
   │               │   │           ├── ws-audio-message.ts
   │               │   │           ├── ws-exercise-answer.ts
   │               │   │           ├── ws-tutor-message.ts
   │               │   │           └── ws-lesson-event.ts
   │               │   ├── application/
   │               │   │   ├── maintainer/lesson.maintainer.ts    # Оркестратор урока
   │               │   │   ├── service/
   │               │   │   │   ├── lesson-context.service.ts      # Сборка контекста
   │               │   │   │   ├── lesson-response.service.ts     # LLM → ответ тьютора
   │               │   │   │   ├── exercise-parser.service.ts     # Парсинг <exercise> тегов
   │               │   │   │   └── audio-pipeline.service.ts      # STT → LLM → TTS
   │               │   │   ├── mapper/lesson.mapper.ts
   │               │   │   └── dto/
   │               │   │       ├── lesson-context.ts
   │               │   │       └── conversation-message.ts
   │               │   └── infrastructure/
   │               │       ├── table/
   │               │       │   ├── lesson.table.ts
   │               │       │   └── lesson-message.table.ts
   │               │       ├── model/
   │               │       │   ├── insert-lesson.ts
   │               │       │   ├── select-lesson.ts
   │               │       │   ├── insert-lesson-message.ts
   │               │       │   └── select-lesson-with-tutor.ts
   │               │       ├── dao/
   │               │       │   ├── lesson.dao.ts
   │               │       │   └── lesson-message.dao.ts
   │               │       ├── repository/
   │               │       │   └── lesson.repository.ts           # DAO координация
   │               │       ├── bull-handler/
   │               │       │   └── post-lesson.bull-handler.ts    # BullMQ: пост-обработка
   │               │       ├── consumer/
   │               │       │   └── lesson-completed.consumer.ts   # Kafka: урок завершён
   │               │       ├── kafka-message-payload/
   │               │       │   └── lesson-completed.payload.ts
   │               │       └── migration/
   │               │
   │               ├── memory/
   │               │   ├── memory.module.ts
   │               │   ├── application/
   │               │   │   ├── maintainer/memory.maintainer.ts
   │               │   │   ├── service/
   │               │   │   │   ├── fact-extraction.service.ts     # LLM → факты
   │               │   │   │   ├── memory-retrieval.service.ts    # pgvector → контекст
   │               │   │   │   └── emotional-context.service.ts
   │               │   │   └── dto/
   │               │   │       ├── extracted-facts.ts
   │               │   │       └── memory-context.ts
   │               │   └── infrastructure/
   │               │       ├── table/
   │               │       │   ├── memory-fact.table.ts
   │               │       │   └── memory-embedding.table.ts
   │               │       ├── model/
   │               │       │   ├── insert-memory-fact.ts
   │               │       │   ├── select-memory-fact.ts
   │               │       │   └── insert-memory-embedding.ts
   │               │       ├── dao/
   │               │       │   ├── memory-fact.dao.ts
   │               │       │   └── memory-embedding.dao.ts
   │               │       ├── bull-handler/
   │               │       │   └── fact-extraction.bull-handler.ts
   │               │       └── migration/
   │               │
   │               ├── homework/
   │               │   ├── homework.module.ts
   │               │   ├── presentation/
   │               │   │   ├── controller/homework.controller.ts
   │               │   │   └── dto/
   │               │   │       ├── body/submit-homework.body.ts
   │               │   │       └── response/homework-detail.response.ts
   │               │   ├── application/
   │               │   │   ├── maintainer/homework.maintainer.ts
   │               │   │   ├── service/
   │               │   │   │   ├── homework-generator.service.ts  # LLM → упражнения
   │               │   │   │   └── homework-checker.service.ts    # Проверка ответов
   │               │   │   └── mapper/homework.mapper.ts
   │               │   └── infrastructure/
   │               │       ├── table/homework.table.ts
   │               │       ├── model/
   │               │       │   ├── insert-homework.ts
   │               │       │   └── select-homework.ts
   │               │       ├── dao/homework.dao.ts
   │               │       ├── bull-handler/
   │               │       │   └── homework-generation.bull-handler.ts
   │               │       └── migration/
   │               │
   │               ├── vocabulary/
   │               │   ├── vocabulary.module.ts
   │               │   ├── presentation/
   │               │   │   ├── controller/vocabulary.controller.ts
   │               │   │   └── dto/
   │               │   │       └── response/vocabulary-list.response.ts
   │               │   ├── application/
   │               │   │   ├── maintainer/vocabulary.maintainer.ts
   │               │   │   └── service/
   │               │   │       └── spaced-repetition.service.ts
   │               │   └── infrastructure/
   │               │       ├── table/vocabulary.table.ts
   │               │       ├── model/
   │               │       │   ├── insert-vocabulary.ts
   │               │       │   └── select-vocabulary.ts
   │               │       ├── dao/vocabulary.dao.ts
   │               │       ├── bull-handler/
   │               │       │   └── review-reminder.bull-handler.ts
   │               │       └── migration/
   │               │
   │               └── progress/
   │                   ├── progress.module.ts
   │                   ├── presentation/
   │                   │   ├── controller/progress.controller.ts
   │                   │   └── dto/
   │                   │       └── response/progress-overview.response.ts
   │                   ├── application/
   │                   │   ├── maintainer/progress.maintainer.ts
   │                   │   └── service/
   │                   │       └── level-assessment.service.ts
   │                   └── infrastructure/
   │                       ├── table/grammar-progress.table.ts
   │                       ├── model/
   │                       │   ├── insert-grammar-progress.ts
   │                       │   └── select-grammar-progress.ts
   │                       ├── dao/grammar-progress.dao.ts
   │                       └── migration/
   │
   └── infra/
   ├── docker/
   │   ├── docker-compose.yml
   │   ├── docker-compose.dev.yml
   │   └── init.sql
   ├── k8s/
   │   ├── namespace.yaml
   │   ├── configmap.yaml
   │   ├── secrets.yaml
   │   ├── web/
   │   │   ├── deployment.yaml
   │   │   ├── service.yaml
   │   │   └── hpa.yaml
   │   ├── api/
   │   │   ├── deployment.yaml
   │   │   ├── service.yaml
   │   │   └── hpa.yaml
   │   ├── worker/
   │   │   ├── deployment.yaml
   │   │   └── hpa.yaml
   │   ├── postgres/
   │   │   ├── statefulset.yaml
   │   │   ├── service.yaml
   │   │   └── pvc.yaml
   │   ├── redis/
   │   │   ├── deployment.yaml
   │   │   └── service.yaml
   │   ├── kafka/
   │   │   ├── statefulset.yaml
   │   │   └── service.yaml
   │   └── ingress.yaml
   └── scripts/
   ├── setup-local.sh
   ├── migrate.sh
   └── seed.sh

3. Архитектурные принципы
   Бэкенд следует трёхслойной архитектуре внутри каждого доменного модуля (@logic/):
   @logic/<domain>/
   ├── presentation/      ← HTTP контроллеры, WebSocket гейтвеи, DTO (body/response/ws)
   ├── application/       ← Бизнес-логика: maintainer (оркестратор), service, mapper, dto
   └── infrastructure/    ← Drizzle таблицы, модели (Zod insert/select), DAO, repository,
   bull-handler, kafka consumer, migration
   Правила зависимостей:

presentation → application (никогда наоборот)
application → infrastructure (через интерфейсы/инъекции)
infrastructure не знает о presentation
Межмодульное взаимодействие — через Kafka-события или экспорт NestJS-модулей

Паттерны:

Maintainer — оркестратор, точка входа в бизнес-логику. Координирует сервисы.
Service — одна ответственность (извлечение фактов, генерация домашки, pipeline голоса).
DAO — Data Access Object, работа с одной таблицей через Drizzle.
Repository — координация нескольких DAO + outbox-события в одной транзакции.
Mapper — преобразование между слоями (DB model → Application DTO → Response).
@Transaction() — CLS-декоратор для атомарных операций.
BullHandler — обработчик фоновых задач (BullMQ).
Consumer — Kafka-консьюмер для межсервисных событий.


4. Пакет shared (Zod-схемы)
   Переиспользуемые схемы и типы между фронтом и бэком.
   packages/shared/src/schemas/user.ts:
   typescriptimport { z } from "zod";

export const CefrLevel = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
export const CorrectionStyle = z.enum(["immediate", "end_of_lesson", "natural"]);
export const SpeakingSpeed = z.enum(["slow", "natural", "fast"]);

export const UserPreferencesSchema = z.object({
correctionStyle: CorrectionStyle.default("immediate"),
explainGrammar: z.boolean().default(true),
speakingSpeed: SpeakingSpeed.default("natural"),
useNativeLanguage: z.boolean().default(false),
preferredExerciseTypes: z.array(z.string()).default([]),
interests: z.array(z.string()).default([]),
});

export const UserSchema = z.object({
id: z.string().uuid(),
googleId: z.string(),
email: z.string().email(),
name: z.string(),
avatarUrl: z.string().url().nullable(),
nativeLanguage: z.string().default("ru"),
currentLevel: CefrLevel.nullable(),
preferences: UserPreferencesSchema,
createdAt: z.date(),
updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type CefrLevelType = z.infer<typeof CefrLevel>;
packages/shared/src/schemas/lesson.ts:
typescriptimport { z } from "zod";

export const LessonStatusSchema = z.enum(["active", "completed", "cancelled"]);

export const ErrorFoundSchema = z.object({
text: z.string(),
correction: z.string(),
topic: z.string(),
explanation: z.string().optional(),
});

export const LessonSummarySchema = z.object({
id: z.string().uuid(),
userId: z.string().uuid(),
tutorId: z.string().uuid(),
status: LessonStatusSchema,
startedAt: z.date(),
endedAt: z.date().nullable(),
durationMinutes: z.number().nullable(),
summary: z.string().nullable(),
topics: z.array(z.string()),
newWords: z.array(z.string()),
errorsFound: z.array(ErrorFoundSchema),
levelAssessment: z.string().nullable(),
});

export type Lesson = z.infer<typeof LessonSummarySchema>;
packages/shared/src/schemas/exercise.ts:
typescriptimport { z } from "zod";

export const ExerciseType = z.enum([
"fill_the_gap",
"multiple_choice",
"sentence_builder",
"error_correction",
"translation",
"matching",
"listening",
"free_response",
]);

export const ExerciseSchema = z.object({
id: z.string(),
type: ExerciseType,
instruction: z.string(),
content: z.record(z.unknown()),
correctAnswer: z.union([z.string(), z.array(z.string())]),
hints: z.array(z.string()).optional(),
topic: z.string(),
difficulty: z.enum(["easy", "medium", "hard"]),
});

export const HomeworkSchema = z.object({
id: z.string().uuid(),
userId: z.string().uuid(),
lessonId: z.string().uuid(),
exercises: z.array(ExerciseSchema),
createdAt: z.date(),
dueAt: z.date().nullable(),
completedAt: z.date().nullable(),
score: z.number().nullable(),
});

export type Exercise = z.infer<typeof ExerciseSchema>;
export type Homework = z.infer<typeof HomeworkSchema>;
packages/shared/src/schemas/memory.ts:
typescriptimport { z } from "zod";

export const MemoryCategory = z.enum([
"personal", "work", "hobby", "family", "travel", "education", "other",
]);

export const EmotionalTone = z.enum([
"happy", "excited", "neutral", "tired", "sad", "frustrated", "anxious",
]);

export const FactExtractionResultSchema = z.object({
facts: z.array(z.object({
category: MemoryCategory,
fact: z.string(),
})),
errors: z.array(z.object({
text: z.string(),
correction: z.string(),
topic: z.string(),
})),
mood: EmotionalTone,
levelSignals: z.string().nullable(),
});

export type FactExtractionResult = z.infer<typeof FactExtractionResultSchema>;

5. Бэкенд: @shared/ модули
   5.1 shared-config (env валидация через Zod)
   apps/api/src/@shared/shared-config/env.schema.ts:
   typescriptimport { z } from "zod";

export const EnvSchema = z.object({
PORT: z.coerce.number().default(4000),
NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

// Database
DATABASE_URL: z.string(),

// Redis
REDIS_URL: z.string().default("redis://localhost:6379"),

// Auth
JWT_SECRET: z.string(),
GOOGLE_CLIENT_ID: z.string(),
GOOGLE_CLIENT_SECRET: z.string(),

// Frontend
FRONTEND_URL: z.string().default("http://localhost:3000"),

// AI
ANTHROPIC_API_KEY: z.string().optional(),
OPENAI_API_KEY: z.string().optional(),

// Voice
DEEPGRAM_API_KEY: z.string(),
ELEVENLABS_API_KEY: z.string(),

// Kafka
KAFKA_BROKERS: z.string().default("localhost:9092"),
KAFKA_GROUP_ID: z.string().default("jake-api"),
});

export type Env = z.infer<typeof EnvSchema>;
apps/api/src/@shared/shared-config/env.service.ts:
typescriptimport { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Env } from "./env.schema";

@Injectable()
export class EnvService {
constructor(private configService: ConfigService) {}

get<K extends keyof Env>(key: K): Env[K] {
return this.configService.get(key) as Env[K];
}
}
5.2 shared-drizzle-pg
apps/api/src/@shared/shared-drizzle-pg/drizzle.provider.ts:
typescriptimport { Provider } from "@nestjs/common";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { EnvService } from "../shared-config/env.service";

export const DRIZZLE = Symbol("DRIZZLE");

export const drizzleProvider: Provider = {
provide: DRIZZLE,
inject: [EnvService],
useFactory: (envService: EnvService) => {
const client = postgres(envService.get("DATABASE_URL"));
return drizzle(client);
},
};
5.3 shared-cls (транзакции)
apps/api/src/@shared/shared-cls/transaction.ts:
typescriptimport { applyDecorators, SetMetadata } from "@nestjs/common";

export const TRANSACTION_KEY = "TRANSACTION";

/**
* Декоратор @Transaction() — оборачивает метод в DB-транзакцию через CLS.
* DAO внутри транзакции автоматически получают tx из AsyncLocalStorage.
  */
  export function Transaction(): MethodDecorator {
  return applyDecorators(SetMetadata(TRANSACTION_KEY, true));
  }
  5.4 shared-ws (WebSocket)
  apps/api/src/@shared/shared-ws/ws-auth.guard.ts:
  typescriptimport { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
  import { JwtService } from "@nestjs/jwt";
  import { WsException } from "@nestjs/websockets";

@Injectable()
export class WsAuthGuard implements CanActivate {
constructor(private jwtService: JwtService) {}

async canActivate(context: ExecutionContext): Promise<boolean> {
const client = context.switchToWs().getClient();
const token =
client.handshake?.query?.token ||
client.handshake?.headers?.authorization?.replace("Bearer ", "");

    if (!token) throw new WsException("Unauthorized");

    try {
      const payload = await this.jwtService.verifyAsync(token);
      client.data = { userId: payload.sub };
      return true;
    } catch {
      throw new WsException("Invalid token");
    }
}
}

6. Бэкенд: @lib/ (низкоуровневые обёртки)
   6.1 LLM Module
   apps/api/src/@lib/llm/src/llm.service.ts:
   typescriptimport { Injectable } from "@nestjs/common";
   import Anthropic from "@anthropic-ai/sdk";
   import { EnvService } from "@shared/shared-config/env.service";

export interface LlmMessage {
role: "user" | "assistant";
content: string;
}

export interface LlmResponse {
text: string;
inputTokens: number;
outputTokens: number;
}

@Injectable()
export class LlmService {
private client: Anthropic;

constructor(private env: EnvService) {
this.client = new Anthropic({ apiKey: env.get("ANTHROPIC_API_KEY") });
}

async generate(
systemPrompt: string,
messages: LlmMessage[],
maxTokens = 1024,
): Promise<LlmResponse> {
const response = await this.client.messages.create({
model: "claude-sonnet-4-20250514",
max_tokens: maxTokens,
system: systemPrompt,
messages,
});

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
}

async generateJson<T>(
systemPrompt: string,
messages: LlmMessage[],
maxTokens = 2048,
): Promise<T> {
const response = await this.generate(systemPrompt, messages, maxTokens);
// Убираем возможные markdown-обёртки
const cleaned = response.text.replace(/```json\n?|```/g, "").trim();
return JSON.parse(cleaned) as T;
}
}
6.2 Voice Module
apps/api/src/@lib/voice/src/stt.service.ts:
typescriptimport { Injectable } from "@nestjs/common";
import { createClient } from "@deepgram/sdk";
import { EnvService } from "@shared/shared-config/env.service";

@Injectable()
export class SttService {
private deepgram;

constructor(private env: EnvService) {
this.deepgram = createClient(env.get("DEEPGRAM_API_KEY"));
}

async transcribe(audioBase64: string): Promise<string> {
const audioBuffer = Buffer.from(audioBase64, "base64");

    const { result } = await this.deepgram.listen.prerecorded.transcriptionPreRecorded(
      { buffer: audioBuffer, mimetype: "audio/webm" },
      { model: "nova-2", language: "en", smart_format: true, punctuate: true },
    );

    return result?.results?.channels[0]?.alternatives[0]?.transcript || "";
}
}
apps/api/src/@lib/voice/src/tts.service.ts:
typescriptimport { Injectable } from "@nestjs/common";
import { EnvService } from "@shared/shared-config/env.service";

@Injectable()
export class TtsService {
constructor(private env: EnvService) {}

async synthesize(text: string, voiceId: string): Promise<string> {
const response = await fetch(
`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
{
method: "POST",
headers: {
"Content-Type": "application/json",
"xi-api-key": this.env.get("ELEVENLABS_API_KEY"),
},
body: JSON.stringify({
text,
model_id: "eleven_turbo_v2_5",
voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
}),
},
);

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("base64");
}
}
6.3 Embedding Module
apps/api/src/@lib/embedding/src/embedding.service.ts:
typescriptimport { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import { EnvService } from "@shared/shared-config/env.service";

@Injectable()
export class EmbeddingService {
private client: OpenAI;

constructor(private env: EnvService) {
this.client = new OpenAI({ apiKey: env.get("OPENAI_API_KEY") });
}

async embed(text: string): Promise<number[]> {
const response = await this.client.embeddings.create({
model: "text-embedding-3-small",
input: text,
});
return response.data[0].embedding;
}
}

7. Бэкенд: @logic/ доменные модули
   7.1 Auth Module
   apps/api/src/@logic/auth/infrastructure/table/user.table.ts:
   typescriptimport {
   pgTable, uuid, varchar, text, timestamp, boolean,
   } from "drizzle-orm/pg-core";

export const userTable = pgTable("users", {
id: uuid("id").primaryKey().defaultRandom(),
googleId: varchar("google_id", { length: 255 }).notNull().unique(),
email: varchar("email", { length: 255 }).notNull().unique(),
name: varchar("name", { length: 255 }).notNull(),
avatarUrl: text("avatar_url"),
nativeLanguage: varchar("native_language", { length: 10 }).default("ru"),
currentLevel: varchar("current_level", { length: 5 }),
onboardingCompleted: boolean("onboarding_completed").default(false),
createdAt: timestamp("created_at").defaultNow().notNull(),
updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
apps/api/src/@logic/auth/infrastructure/table/user-preference.table.ts:
typescriptimport {
pgTable, uuid, varchar, boolean, jsonb, timestamp,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.table";

export const userPreferenceTable = pgTable("user_preferences", {
id: uuid("id").primaryKey().defaultRandom(),
userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull().unique(),
correctionStyle: varchar("correction_style", { length: 50 }).default("immediate"),
explainGrammar: boolean("explain_grammar").default(true),
speakingSpeed: varchar("speaking_speed", { length: 20 }).default("natural"),
useNativeLanguage: boolean("use_native_language").default(false),
preferredExerciseTypes: jsonb("preferred_exercise_types").$type<string[]>().default([]),
interests: jsonb("interests").$type<string[]>().default([]),
updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
apps/api/src/@logic/auth/infrastructure/model/insert-user.ts:
typescriptimport { createInsertSchema } from "drizzle-zod";
import { userTable } from "../table/user.table";

export const insertUserSchema = createInsertSchema(userTable);
export type InsertUser = typeof userTable.$inferInsert;
apps/api/src/@logic/auth/infrastructure/model/select-user.ts:
typescriptimport { createSelectSchema } from "drizzle-zod";
import { userTable } from "../table/user.table";

export const selectUserSchema = createSelectSchema(userTable);
export type SelectUser = typeof userTable.$inferSelect;
apps/api/src/@logic/auth/infrastructure/dao/user.dao.ts:
typescriptimport { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "@shared/shared-drizzle-pg/drizzle.provider";
import { userTable } from "../table/user.table";
import { userPreferenceTable } from "../table/user-preference.table";
import { InsertUser } from "../model/insert-user";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class UserDao {
constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

async findByGoogleId(googleId: string) {
const [user] = await this.db
.select()
.from(userTable)
.where(eq(userTable.googleId, googleId))
.limit(1);
return user ?? null;
}

async findById(id: string) {
const [user] = await this.db
.select()
.from(userTable)
.where(eq(userTable.id, id))
.limit(1);
return user ?? null;
}

async findByIdWithPreferences(id: string) {
const [result] = await this.db
.select()
.from(userTable)
.leftJoin(userPreferenceTable, eq(userTable.id, userPreferenceTable.userId))
.where(eq(userTable.id, id))
.limit(1);
return result ?? null;
}

async create(data: InsertUser) {
const [user] = await this.db.insert(userTable).values(data).returning();
// Создаём дефолтные предпочтения
await this.db.insert(userPreferenceTable).values({ userId: user.id });
return user;
}

async updateLevel(id: string, level: string) {
await this.db
.update(userTable)
.set({ currentLevel: level, updatedAt: new Date() })
.where(eq(userTable.id, id));
}
}
apps/api/src/@logic/auth/application/maintainer/auth.maintainer.ts:
typescriptimport { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserDao } from "../../infrastructure/dao/user.dao";
import { Transaction } from "@shared/shared-cls/transaction";

@Injectable()
export class AuthMaintainer {
constructor(
private userDao: UserDao,
private jwtService: JwtService,
) {}

@Transaction()
async googleAuth(googleUser: {
googleId: string;
email: string;
name: string;
avatarUrl: string | null;
}) {
// Находим или создаём пользователя
let user = await this.userDao.findByGoogleId(googleUser.googleId);

    if (!user) {
      user = await this.userDao.create({
        googleId: googleUser.googleId,
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.avatarUrl,
      });
    }

    // Генерируем JWT
    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return { token, user };
}
}
apps/api/src/@logic/auth/presentation/controller/auth.controller.ts:
typescriptimport { Body, Controller, Post } from "@nestjs/common";
import { AuthMaintainer } from "../../application/maintainer/auth.maintainer";
import { GoogleAuthBody } from "../dto/body/google-auth.body";

@Controller("auth")
export class AuthController {
constructor(private authMaintainer: AuthMaintainer) {}

@Post("google")
async googleAuth(@Body() body: GoogleAuthBody) {
return this.authMaintainer.googleAuth(body);
}
}

7.2 Tutor Module
apps/api/src/@logic/tutor/infrastructure/table/tutor.table.ts:
typescriptimport { pgTable, uuid, varchar, text, jsonb, boolean } from "drizzle-orm/pg-core";

export const tutorTable = pgTable("tutors", {
id: uuid("id").primaryKey().defaultRandom(),
name: varchar("name", { length: 100 }).notNull(),
personality: text("personality").notNull(),
systemPrompt: text("system_prompt").notNull(),
voiceId: varchar("voice_id", { length: 255 }).notNull(),
accent: varchar("accent", { length: 50 }).notNull(),
avatarUrl: text("avatar_url"),
traits: jsonb("traits").$type<string[]>().default([]),
isActive: boolean("is_active").default(true),
});
apps/api/src/@logic/tutor/infrastructure/table/user-tutor.table.ts:
typescriptimport { pgTable, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { userTable } from "@logic/auth/infrastructure/table/user.table";
import { tutorTable } from "./tutor.table";

export const userTutorTable = pgTable("user_tutors", {
id: uuid("id").primaryKey().defaultRandom(),
userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull(),
tutorId: uuid("tutor_id").references(() => tutorTable.id).notNull(),
isActive: boolean("is_active").default(true),
selectedAt: timestamp("selected_at").defaultNow().notNull(),
});

7.3 Lesson Module (ядро приложения)
apps/api/src/@logic/lesson/infrastructure/table/lesson.table.ts:
typescriptimport { pgTable, uuid, varchar, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { userTable } from "@logic/auth/infrastructure/table/user.table";
import { tutorTable } from "@logic/tutor/infrastructure/table/tutor.table";

export const lessonTable = pgTable("lessons", {
id: uuid("id").primaryKey().defaultRandom(),
userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull(),
tutorId: uuid("tutor_id").references(() => tutorTable.id).notNull(),
status: varchar("status", { length: 20 }).default("active").notNull(),
startedAt: timestamp("started_at").defaultNow().notNull(),
endedAt: timestamp("ended_at"),
durationMinutes: integer("duration_minutes"),
summary: text("summary"),
topics: jsonb("topics").$type<string[]>().default([]),
newWords: jsonb("new_words").$type<string[]>().default([]),
errorsFound: jsonb("errors_found")
.$type<Array<{ text: string; correction: string; topic: string }>>()
.default([]),
levelAssessment: varchar("level_assessment", { length: 5 }),
lessonNumber: integer("lesson_number").notNull(),
});
apps/api/src/@logic/lesson/infrastructure/table/lesson-message.table.ts:
typescriptimport { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { lessonTable } from "./lesson.table";

export const lessonMessageTable = pgTable("lesson_messages", {
id: uuid("id").primaryKey().defaultRandom(),
lessonId: uuid("lesson_id").references(() => lessonTable.id, { onDelete: "cascade" }).notNull(),
role: varchar("role", { length: 10 }).notNull(), // user | tutor | system
content: text("content").notNull(),
audioUrl: text("audio_url"),
timestamp: timestamp("timestamp").defaultNow().notNull(),
});
apps/api/src/@logic/lesson/infrastructure/dao/lesson.dao.ts:
typescriptimport { Inject, Injectable } from "@nestjs/common";
import { eq, sql, desc } from "drizzle-orm";
import { DRIZZLE } from "@shared/shared-drizzle-pg/drizzle.provider";
import { lessonTable } from "../table/lesson.table";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class LessonDao {
constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

async create(data: typeof lessonTable.$inferInsert) {
const [lesson] = await this.db.insert(lessonTable).values(data).returning();
return lesson;
}

async findById(id: string) {
const [lesson] = await this.db
.select()
.from(lessonTable)
.where(eq(lessonTable.id, id))
.limit(1);
return lesson ?? null;
}

async countByUser(userId: string): Promise<number> {
const [result] = await this.db
.select({ count: sql<number>`count(*)::int` })
.from(lessonTable)
.where(eq(lessonTable.userId, userId));
return result.count;
}

async findRecentByUser(userId: string, limit = 10) {
return this.db
.select()
.from(lessonTable)
.where(eq(lessonTable.userId, userId))
.orderBy(desc(lessonTable.startedAt))
.limit(limit);
}

async complete(id: string, data: Partial<typeof lessonTable.$inferInsert>) {
await this.db
.update(lessonTable)
.set({ ...data, status: "completed", endedAt: new Date() })
.where(eq(lessonTable.id, id));
}
}
apps/api/src/@logic/lesson/infrastructure/dao/lesson-message.dao.ts:
typescriptimport { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "@shared/shared-drizzle-pg/drizzle.provider";
import { lessonMessageTable } from "../table/lesson-message.table";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class LessonMessageDao {
constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) {}

async create(data: typeof lessonMessageTable.$inferInsert) {
const [msg] = await this.db.insert(lessonMessageTable).values(data).returning();
return msg;
}

async findByLesson(lessonId: string) {
return this.db
.select()
.from(lessonMessageTable)
.where(eq(lessonMessageTable.lessonId, lessonId))
.orderBy(lessonMessageTable.timestamp);
}
}
apps/api/src/@logic/lesson/infrastructure/repository/lesson.repository.ts:
typescriptimport { Injectable } from "@nestjs/common";
import { LessonDao } from "../dao/lesson.dao";
import { LessonMessageDao } from "../dao/lesson-message.dao";
import { Transaction } from "@shared/shared-cls/transaction";

@Injectable()
export class LessonRepository {
constructor(
private lessonDao: LessonDao,
private messageDao: LessonMessageDao,
) {}

@Transaction()
async createWithGreeting(
lessonData: Parameters<LessonDao["create"]>[0],
greeting: string,
) {
const lesson = await this.lessonDao.create(lessonData);
await this.messageDao.create({
lessonId: lesson.id,
role: "tutor",
content: greeting,
});
return lesson;
}
}
apps/api/src/@logic/lesson/application/service/lesson-context.service.ts — сборка контекста:
typescriptimport { Injectable } from "@nestjs/common";
import { UserDao } from "@logic/auth/infrastructure/dao/user.dao";
import { LessonDao } from "../../infrastructure/dao/lesson.dao";
import { MemoryFactDao } from "@logic/memory/infrastructure/dao/memory-fact.dao";
import { MemoryEmbeddingDao } from "@logic/memory/infrastructure/dao/memory-embedding.dao";
import { GrammarProgressDao } from "@logic/progress/infrastructure/dao/grammar-progress.dao";
import { VocabularyDao } from "@logic/vocabulary/infrastructure/dao/vocabulary.dao";
import { TutorDao } from "@logic/tutor/infrastructure/dao/tutor.dao";
import { UserTutorDao } from "@logic/tutor/infrastructure/dao/user-tutor.dao";
import { LessonContext } from "../dto/lesson-context";

@Injectable()
export class LessonContextService {
constructor(
private userDao: UserDao,
private lessonDao: LessonDao,
private memoryFactDao: MemoryFactDao,
private memoryEmbeddingDao: MemoryEmbeddingDao,
private grammarProgressDao: GrammarProgressDao,
private vocabularyDao: VocabularyDao,
private userTutorDao: UserTutorDao,
) {}

async build(userId: string): Promise<LessonContext> {
const [
user,
facts,
recentEmbeddings,
grammarProgress,
recentVocab,
activeTutor,
lessonCount,
] = await Promise.all([
this.userDao.findByIdWithPreferences(userId),
this.memoryFactDao.findActiveByUser(userId, 50),
this.memoryEmbeddingDao.findRecentByUser(userId, 5),
this.grammarProgressDao.findByUser(userId),
this.vocabularyDao.findRecentByUser(userId, 20),
this.userTutorDao.findActiveByUser(userId),
this.lessonDao.countByUser(userId),
]);

    if (!user || !activeTutor) throw new Error("User or tutor not found");

    const prefs = user.user_preferences;

    return {
      studentName: user.users.name,
      level: user.users.currentLevel,
      lessonNumber: lessonCount + 1,
      tutorSystemPrompt: activeTutor.tutor.systemPrompt,
      tutorVoiceId: activeTutor.tutor.voiceId,
      tutorId: activeTutor.tutorId,
      preferences: {
        correctionStyle: prefs?.correctionStyle || "immediate",
        speakingSpeed: prefs?.speakingSpeed || "natural",
        useNativeLanguage: prefs?.useNativeLanguage || false,
        explainGrammar: prefs?.explainGrammar || true,
        preferredExercises: prefs?.preferredExerciseTypes || [],
        interests: prefs?.interests || [],
      },
      facts: facts.map((f) => ({
        category: f.category,
        fact: f.fact,
      })),
      recentEmotionalContext: recentEmbeddings.map(
        (e) => `- Lesson: ${e.emotionalTone} — ${e.content}`,
      ),
      learningFocus: {
        weakAreas: grammarProgress.filter((g) => g.level < 50).map((g) => g.topic),
        strongAreas: grammarProgress.filter((g) => g.level >= 70).map((g) => g.topic),
        recentWords: recentVocab.map((v) => v.word),
        suggestedTopic: grammarProgress.find((g) => g.level < 30)?.topic || null,
      },
    };
}
}
apps/api/src/@logic/lesson/application/service/lesson-response.service.ts:
typescriptimport { Injectable } from "@nestjs/common";
import { LlmService, LlmMessage } from "@lib/llm/src/llm.service";
import { ExerciseParserService } from "./exercise-parser.service";

@Injectable()
export class LessonResponseService {
constructor(
private llm: LlmService,
private exerciseParser: ExerciseParserService,
) {}

async generate(
systemPrompt: string,
history: LlmMessage[],
) {
const response = await this.llm.generate(systemPrompt, history);
const exercise = this.exerciseParser.extract(response.text);
const cleanText = this.exerciseParser.removeExerciseTags(response.text);

    return { text: cleanText, exercise, tokens: response };
}
}
apps/api/src/@logic/lesson/application/service/exercise-parser.service.ts:
typescriptimport { Injectable } from "@nestjs/common";

@Injectable()
export class ExerciseParserService {
extract(text: string) {
const match = text.match(/<exercise>([\s\S]*?)<\/exercise>/);
if (!match) return null;
try {
return JSON.parse(match[1]);
} catch {
return null;
}
}

removeExerciseTags(text: string): string {
return text.replace(/<exercise>[\s\S]*?<\/exercise>/g, "").trim();
}
}
apps/api/src/@logic/lesson/application/service/audio-pipeline.service.ts:
typescriptimport { Injectable } from "@nestjs/common";
import { SttService } from "@lib/voice/src/stt.service";
import { TtsService } from "@lib/voice/src/tts.service";
import { LessonResponseService } from "./lesson-response.service";
import { LlmMessage } from "@lib/llm/src/llm.service";

@Injectable()
export class AudioPipelineService {
constructor(
private stt: SttService,
private tts: TtsService,
private lessonResponse: LessonResponseService,
) {}

async processAudio(
audioBase64: string,
systemPrompt: string,
history: LlmMessage[],
voiceId: string,
) {
// 1. STT
const transcript = await this.stt.transcribe(audioBase64);

    // 2. Добавляем в историю
    const updatedHistory: LlmMessage[] = [
      ...history,
      { role: "user", content: transcript },
    ];

    // 3. LLM
    const response = await this.lessonResponse.generate(systemPrompt, updatedHistory);

    // 4. TTS
    const audio = await this.tts.synthesize(response.text, voiceId);

    return {
      transcript,
      tutorText: response.text,
      tutorAudio: audio,
      exercise: response.exercise,
    };
}
}
apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts — оркестратор:
typescriptimport { Injectable } from "@nestjs/common";
import { LessonDao } from "../../infrastructure/dao/lesson.dao";
import { LessonMessageDao } from "../../infrastructure/dao/lesson-message.dao";
import { LessonRepository } from "../../infrastructure/repository/lesson.repository";
import { LessonContextService } from "../service/lesson-context.service";
import { LessonResponseService } from "../service/lesson-response.service";
import { AudioPipelineService } from "../service/audio-pipeline.service";
import { LlmMessage } from "@lib/llm/src/llm.service";
import { TtsService } from "@lib/voice/src/tts.service";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";

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

async startLesson(userId: string) {
const context = await this.contextService.build(userId);

    const systemPrompt = this.buildSystemPrompt(context);

    // Генерируем приветствие
    const greeting = await this.responseService.generate(systemPrompt, [
      { role: "user", content: "Start the lesson with a warm greeting." },
    ]);

    // Создаём урок + первое сообщение в транзакции
    const lesson = await this.lessonRepo.createWithGreeting(
      {
        userId,
        tutorId: context.tutorId,
        lessonNumber: context.lessonNumber,
      },
      greeting.text,
    );

    // TTS
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

    // Сохраняем сообщения
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

    // Фоновое извлечение фактов
    await this.factQueue.add("extract", {
      userId,
      lessonId,
      userMessage: result.transcript,
      history: [...history, { role: "user", content: result.transcript }],
    });

    return result;
}

async endLesson(lessonId: string, history: LlmMessage[]) {
await this.lessonDao.complete(lessonId, {});

    // Ставим в очередь пост-обработку
    await this.postLessonQueue.add("process", {
      lessonId,
      conversationHistory: history,
    });
}

private buildSystemPrompt(context: any): string {
// Полный системный промпт — см. раздел "Промпты" ниже
return buildFullSystemPrompt(context);
}
}
apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts — WebSocket Gateway:
typescriptimport {
WebSocketGateway,
WebSocketServer,
SubscribeMessage,
OnGatewayConnection,
OnGatewayDisconnect,
ConnectedSocket,
MessageBody,
} from "@nestjs/websockets";
import { UseGuards } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { WsAuthGuard } from "@shared/shared-ws/ws-auth.guard";
import { LessonMaintainer } from "../../application/maintainer/lesson.maintainer";
import { LlmMessage } from "@lib/llm/src/llm.service";

interface LessonSession {
lessonId: string;
systemPrompt: string;
voiceId: string;
history: LlmMessage[];
}

@WebSocketGateway({ namespace: "/ws/lesson", cors: true })
@UseGuards(WsAuthGuard)
export class LessonGateway implements OnGatewayConnection, OnGatewayDisconnect {
@WebSocketServer()
server: Server;

// In-memory session storage (per connection)
private sessions = new Map<string, LessonSession>();

constructor(private lessonMaintainer: LessonMaintainer) {}

async handleConnection(client: Socket) {
const userId = client.data.userId;
if (!userId) {
client.disconnect();
return;
}

    try {
      const result = await this.lessonMaintainer.startLesson(userId);

      const session: LessonSession = {
        lessonId: result.lessonId,
        systemPrompt: result.systemPrompt,
        voiceId: result.voiceId,
        history: [{ role: "assistant", content: result.greeting.text }],
      };
      this.sessions.set(client.id, session);

      client.emit("lesson_started", {
        lessonId: result.lessonId,
      });

      client.emit("tutor_message", {
        text: result.greeting.text,
        audio: result.greeting.audio,
        exercise: result.greeting.exercise,
      });
    } catch (error) {
      client.emit("error", { message: "Failed to start lesson" });
      client.disconnect();
    }
}

async handleDisconnect(client: Socket) {
const session = this.sessions.get(client.id);
if (session) {
await this.lessonMaintainer.endLesson(session.lessonId, session.history);
this.sessions.delete(client.id);
}
}

@SubscribeMessage("audio")
async handleAudio(
@ConnectedSocket() client: Socket,
@MessageBody() data: { audio: string },
) {
const session = this.sessions.get(client.id);
if (!session) return;

    const userId = client.data.userId;

    try {
      client.emit("status", { state: "thinking" });

      const result = await this.lessonMaintainer.processUserAudio(
        session.lessonId,
        userId,
        data.audio,
        session.systemPrompt,
        session.history,
        session.voiceId,
      );

      // Обновляем историю
      session.history.push(
        { role: "user", content: result.transcript },
        { role: "assistant", content: result.tutorText },
      );

      client.emit("transcript", { text: result.transcript });
      client.emit("tutor_message", {
        text: result.tutorText,
        audio: result.tutorAudio,
        exercise: result.exercise,
      });
    } catch (error) {
      client.emit("error", { message: "Something went wrong, mate!" });
    }
}

@SubscribeMessage("exercise_answer")
async handleExerciseAnswer(
@ConnectedSocket() client: Socket,
@MessageBody() data: { exerciseId: string; answer: string },
) {
const session = this.sessions.get(client.id);
if (!session) return;

    // Добавляем ответ ученика в историю и просим тьютора прокомментировать
    session.history.push({
      role: "user",
      content: `[Exercise answer: ${data.answer}]`,
    });

    const result = await this.lessonMaintainer.processUserAudio(
      session.lessonId,
      client.data.userId,
      "", // Нет аудио, текстовый ввод
      session.systemPrompt,
      session.history,
      session.voiceId,
    );

    session.history.push({ role: "assistant", content: result.tutorText });

    client.emit("exercise_feedback", {
      text: result.tutorText,
      audio: result.tutorAudio,
    });
}

@SubscribeMessage("end_lesson")
async handleEndLesson(@ConnectedSocket() client: Socket) {
const session = this.sessions.get(client.id);
if (!session) return;

    await this.lessonMaintainer.endLesson(session.lessonId, session.history);
    this.sessions.delete(client.id);

    client.emit("lesson_ended", { lessonId: session.lessonId });
    client.disconnect();
}
}

7.4 Memory Module
apps/api/src/@logic/memory/infrastructure/table/memory-fact.table.ts:
typescriptimport { pgTable, uuid, varchar, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { userTable } from "@logic/auth/infrastructure/table/user.table";

export const memoryFactTable = pgTable(
"memory_facts",
{
id: uuid("id").primaryKey().defaultRandom(),
userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull(),
category: varchar("category", { length: 50 }).notNull(),
fact: text("fact").notNull(),
source: varchar("source", { length: 255 }).notNull(),
isActive: boolean("is_active").default(true),
createdAt: timestamp("created_at").defaultNow().notNull(),
updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
(table) => ({
userIdx: index("memory_facts_user_idx").on(table.userId),
categoryIdx: index("memory_facts_category_idx").on(table.userId, table.category),
}),
);
apps/api/src/@logic/memory/infrastructure/table/memory-embedding.table.ts:
typescriptimport { pgTable, uuid, text, varchar, timestamp, index, customType } from "drizzle-orm/pg-core";
import { userTable } from "@logic/auth/infrastructure/table/user.table";
import { lessonTable } from "@logic/lesson/infrastructure/table/lesson.table";

const vector = customType<{ data: number[]; driverType: string }>({
dataType() {
return "vector(1536)";
},
toDriver(value: number[]) {
return `[${value.join(",")}]`;
},
});

export const memoryEmbeddingTable = pgTable(
"memory_embeddings",
{
id: uuid("id").primaryKey().defaultRandom(),
userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull(),
lessonId: uuid("lesson_id").references(() => lessonTable.id),
content: text("content").notNull(),
embedding: vector("embedding"),
emotionalTone: varchar("emotional_tone", { length: 20 }),
createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => ({
userIdx: index("memory_embeddings_user_idx").on(table.userId),
}),
);
apps/api/src/@logic/memory/application/service/fact-extraction.service.ts:
typescriptimport { Injectable } from "@nestjs/common";
import { LlmService, LlmMessage } from "@lib/llm/src/llm.service";
import { MemoryFactDao } from "../../infrastructure/dao/memory-fact.dao";
import { FactExtractionResultSchema } from "@jake/shared";

const FACT_EXTRACTION_PROMPT = `
Analyze the student's message in the context of the conversation.
Extract any NEW personal facts, errors, mood, and level signals.

Return ONLY valid JSON:
{
"facts": [{"category": "personal|work|hobby|family|travel|education|other", "fact": "Short statement"}],
"errors": [{"text": "wrong text", "correction": "correct version", "topic": "grammar_topic"}],
"mood": "happy|excited|neutral|tired|sad|frustrated|anxious",
"levelSignals": "Brief note or null"
}
`;

@Injectable()
export class FactExtractionService {
constructor(
private llm: LlmService,
private factDao: MemoryFactDao,
) {}

async extractAndSave(
userId: string,
lessonId: string,
userMessage: string,
history: LlmMessage[],
) {
const result = await this.llm.generateJson<any>(
FACT_EXTRACTION_PROMPT,
[...history, { role: "user", content: userMessage }],
);

    // Валидация через Zod
    const parsed = FactExtractionResultSchema.safeParse(result);
    if (!parsed.success) return null;

    // Сохраняем новые факты
    for (const fact of parsed.data.facts) {
      await this.factDao.create({
        userId,
        category: fact.category,
        fact: fact.fact,
        source: lessonId,
      });
    }

    return parsed.data;
}
}

7.5 Homework Module
apps/api/src/@logic/homework/infrastructure/bull-handler/homework-generation.bull-handler.ts:
typescriptimport { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { HomeworkGeneratorService } from "../../application/service/homework-generator.service";

@Processor("homework-generation")
export class HomeworkGenerationBullHandler extends WorkerHost {
constructor(private generator: HomeworkGeneratorService) {
super();
}

async process(job: Job) {
const { lessonId, userId, lessonSummary, userPreferences } = job.data;
await this.generator.generateAndSave(lessonId, userId, lessonSummary, userPreferences);
}
}
apps/api/src/@logic/homework/application/service/homework-generator.service.ts:
typescriptimport { Injectable } from "@nestjs/common";
import { LlmService } from "@lib/llm/src/llm.service";
import { HomeworkDao } from "../../infrastructure/dao/homework.dao";

@Injectable()
export class HomeworkGeneratorService {
constructor(
private llm: LlmService,
private homeworkDao: HomeworkDao,
) {}

async generateAndSave(
lessonId: string,
userId: string,
summary: any,
preferences: any,
) {
const prompt = `Generate homework exercises based on today's lesson.

Student level: ${summary.levelAssessment || "A2"}
Weak areas: ${summary.errorsFound?.map((e: any) => e.topic).join(", ")}
Topics covered: ${summary.topics?.join(", ")}
New words: ${summary.newWords?.join(", ")}
Student prefers: ${preferences.preferredExerciseTypes?.join(", ") || "no preference"}
Student interests: ${preferences.interests?.join(", ")}

Generate 5-7 exercises. Return ONLY valid JSON array:
[{
"id": "hw_1",
"type": "fill_the_gap|multiple_choice|sentence_builder|error_correction",
"instruction": "string",
"content": {},
"correctAnswer": "string",
"topic": "string",
"difficulty": "easy|medium|hard"
}]

Make exercises fun and use the student's interests for context.`;

    const exercises = await this.llm.generateJson<any[]>(
      "You are an exercise generator. Return only JSON.",
      [{ role: "user", content: prompt }],
      4096,
    );

    await this.homeworkDao.create({
      userId,
      lessonId,
      exercises,
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    });
}
}

7.6 Post-Lesson Bull Handler (координация)
apps/api/src/@logic/lesson/infrastructure/bull-handler/post-lesson.bull-handler.ts:
typescriptimport { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { LlmService } from "@lib/llm/src/llm.service";
import { EmbeddingService } from "@lib/embedding/src/embedding.service";
import { LessonDao } from "../dao/lesson.dao";
import { UserDao } from "@logic/auth/infrastructure/dao/user.dao";
import { VocabularyDao } from "@logic/vocabulary/infrastructure/dao/vocabulary.dao";
import { GrammarProgressDao } from "@logic/progress/infrastructure/dao/grammar-progress.dao";
import { MemoryEmbeddingDao } from "@logic/memory/infrastructure/dao/memory-embedding.dao";
import { HomeworkGeneratorService } from "@logic/homework/application/service/homework-generator.service";
import { KafkaProducerService } from "@lib/kafka/src/kafka-producer.service";

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
private kafkaProducer: KafkaProducerService,
) {
super();
}

async process(job: Job) {
const { lessonId, conversationHistory } = job.data;

    const lesson = await this.lessonDao.findById(lessonId);
    if (!lesson) return;

    // 1. Генерируем саммари
    const historyText = conversationHistory
      .map((m: any) => `${m.role}: ${m.content}`)
      .join("\n");

    const summary = await this.llm.generateJson<any>(
      SUMMARY_PROMPT,
      [{ role: "user", content: historyText }],
    );

    // 2. Обновляем урок
    await this.lessonDao.complete(lessonId, {
      summary: summary.summary,
      topics: summary.topics,
      newWords: summary.newWords,
      errorsFound: summary.errorsFound,
      levelAssessment: summary.levelAssessment,
      durationMinutes: Math.round(
        (Date.now() - lesson.startedAt.getTime()) / 60000,
      ),
    });

    // 3. Обновляем уровень пользователя
    if (summary.levelAssessment) {
      await this.userDao.updateLevel(lesson.userId, summary.levelAssessment);
    }

    // 4. Эмоциональный эмбеддинг → pgvector
    if (summary.emotionalSummary) {
      const embedding = await this.embeddingService.embed(summary.emotionalSummary);
      await this.embeddingDao.create({
        userId: lesson.userId,
        lessonId,
        content: summary.emotionalSummary,
        embedding,
        emotionalTone: summary.emotionalSummary.includes("tired") ? "tired" : "neutral",
      });
    }

    // 5. Сохраняем новые слова
    for (const word of summary.newWords || []) {
      await this.vocabDao.upsert({
        userId: lesson.userId,
        word,
        lessonId,
        strength: 10,
        nextReview: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    // 6. Обновляем grammar progress
    for (const error of summary.errorsFound || []) {
      await this.grammarDao.upsertError(lesson.userId, error.topic);
    }

    // 7. Генерируем домашку
    const user = await this.userDao.findByIdWithPreferences(lesson.userId);
    await this.homeworkGenerator.generateAndSave(
      lessonId,
      lesson.userId,
      summary,
      user?.user_preferences || {},
    );

    // 8. Kafka-событие (для аналитики, уведомлений и т.д.)
    await this.kafkaProducer.send("lesson.completed", {
      lessonId,
      userId: lesson.userId,
      level: summary.levelAssessment,
    });
}
}

8. App Module (корневой)
   apps/api/src/app.module.ts:
   typescriptimport { Module } from "@nestjs/common";
   import { JwtModule } from "@nestjs/jwt";

// @shared
import { SharedConfigModule } from "./@shared/shared-config/shared-config.module";
import { SharedDrizzlePgModule } from "./@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedClsModule } from "./@shared/shared-cls/shared-cls.module";
import { SharedRedisModule } from "./@shared/shared-redis/shared-redis.module";
import { SharedJobModule } from "./@shared/shared-job/shared-job.module";
import { SharedKafkaModule } from "./@shared/shared-kafka/shared-kafka.module";
import { SharedZodHttpModule } from "./@shared/shared-zod-http/shared-zod-http.module";
import { SharedWsModule } from "./@shared/shared-ws/shared-ws.module";

// @logic
import { HealthModule } from "./@logic/health/health.module";
import { AuthModule } from "./@logic/auth/auth.module";
import { TutorModule } from "./@logic/tutor/tutor.module";
import { LessonModule } from "./@logic/lesson/lesson.module";
import { MemoryModule } from "./@logic/memory/memory.module";
import { HomeworkModule } from "./@logic/homework/homework.module";
import { VocabularyModule } from "./@logic/vocabulary/vocabulary.module";
import { ProgressModule } from "./@logic/progress/progress.module";

@Module({
imports: [
// Shared infrastructure
SharedConfigModule,
SharedDrizzlePgModule,
SharedClsModule,
SharedRedisModule,
SharedJobModule,
SharedKafkaModule,
SharedZodHttpModule,
SharedWsModule,
JwtModule.register({ global: true, secret: process.env.JWT_SECRET }),

    // Domain modules
    HealthModule,
    AuthModule,
    TutorModule,
    LessonModule,
    MemoryModule,
    HomeworkModule,
    VocabularyModule,
    ProgressModule,
],
})
export class AppModule {}
apps/api/src/main.ts:
typescriptimport { createApp } from "./create-app";

async function bootstrap() {
const app = await createApp();
const port = process.env.PORT || 4000;
await app.listen(port, "0.0.0.0");
console.log(`API running on port ${port}`);
}
bootstrap();
apps/api/src/create-app.ts:
typescriptimport { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { IoAdapter } from "@nestjs/platform-socket.io";

export async function createApp() {
const app = await NestFactory.create<NestFastifyApplication>(
AppModule,
new FastifyAdapter(),
);

app.enableCors({
origin: process.env.FRONTEND_URL || "http://localhost:3000",
credentials: true,
});

// Socket.io adapter для WebSocket
app.useWebSocketAdapter(new IoAdapter(app));

return app;
}

9. Промпты
   9.1 Базовый системный промпт Jake
   You are Jake, a friendly Australian English tutor in your late 20s.
   You're laid-back, funny, and genuinely interested in your students' lives.
   You use casual Australian slang sometimes (mate, reckon, heaps, no worries,
   arvo, brekkie) but not too much.
   You feel like a close friend who happens to be great at teaching English.

CORE RULES:
- NEVER break character. You are Jake, not an AI.
- Be genuinely curious — ask follow-up questions about their life.
- Use humor naturally — don't force jokes.
- Follow the student's preferred correction style.
- If the student wants to just chat — weave learning naturally into conversation.
- Suggest exercises only when there's a natural pause or a new concept.
- Remember and reference things the student told you before.
- React to emotions — if they're tired, keep it light.
- At the end, summarize what was practiced and tease next lesson.
  9.2 Контекстный промпт (генерируется context-builder)
  === STUDENT PROFILE ===
  Name: {name}
  Level: {level}
  Lesson number: {lessonNumber}

=== PREFERENCES ===
Correction: {correctionStyle} — {correctionRule}
Grammar explanations: {yes/no}
Speed: {speakingSpeed}
Use native language: {yes/no}
Favorite exercises: {list}
Interests: {list}

=== KNOWN FACTS ===
{facts list}

=== EMOTIONAL CONTEXT ===
{recent emotional summaries}

=== LEARNING FOCUS ===
Weak areas: {list}
Strong areas: {list}
Recent words: {list}
Suggested topic: {topic}

=== FIRST LESSON INSTRUCTIONS ===
{special instructions for first lesson if applicable}

=== EXERCISE FORMAT ===
When giving an exercise, wrap it in <exercise> JSON tags.
The frontend renders it as an interactive card.

10. Фронтенд (Next.js)
    Фронтенд остаётся на Next.js с тем же UI. Ключевые файлы:

apps/web/src/app/(app)/lesson/page.tsx — экран урока (голубой градиент, аватарка, волна)
apps/web/src/hooks/useWebSocket.ts — Socket.io клиент (вместо raw WS)
apps/web/src/hooks/useVoiceRecorder.ts — запись голоса
apps/web/src/hooks/useAudioPlayer.ts — воспроизведение TTS

Единственное изменение — подключение через Socket.io вместо raw WebSocket, потому что NestJS Gateway использует Socket.io:
apps/web/src/hooks/useWebSocket.ts (Socket.io версия):
typescriptimport { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface UseWebSocketOptions {
url: string;
onEvent: (event: string, data: any) => void;
}

export function useWebSocket({ url, onEvent }: UseWebSocketOptions) {
const socketRef = useRef<Socket | null>(null);
const [connected, setConnected] = useState(false);

useEffect(() => {
const token = localStorage.getItem("session_token");
const socket = io(url, {
auth: { token },
transports: ["websocket"],
});

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // Слушаем все события
    const events = [
      "lesson_started", "tutor_message", "transcript",
      "exercise_feedback", "lesson_ended", "status", "error",
    ];
    events.forEach((event) => socket.on(event, (data) => onEvent(event, data)));

    socketRef.current = socket;
    return () => { socket.disconnect(); };
}, [url]);

const emit = useCallback((event: string, data: any) => {
socketRef.current?.emit(event, data);
}, []);

return { emit, connected };
}

11. Docker
    apps/api/Dockerfile:
    dockerfileFROM node:20-alpine AS base
    RUN corepack enable && corepack prepare pnpm@9 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @jake/shared build
RUN pnpm --filter @jake/api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/main.js"]
infra/docker/docker-compose.yml:
yamlversion: "3.8"

services:
postgres:
image: pgvector/pgvector:pg16
environment:
POSTGRES_USER: jake
POSTGRES_PASSWORD: jake_dev
POSTGRES_DB: jake
ports:
- "5432:5432"
volumes:
- postgres_data:/var/lib/postgresql/data
- ./init.sql:/docker-entrypoint-initdb.d/init.sql

redis:
image: redis:7-alpine
ports:
- "6379:6379"
volumes:
- redis_data:/data

kafka:
image: bitnami/kafka:3.7
environment:
KAFKA_CFG_NODE_ID: 0
KAFKA_CFG_PROCESS_ROLES: controller,broker
KAFKA_CFG_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 0@kafka:9093
KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
ports:
- "9092:9092"
volumes:
- kafka_data:/bitnami/kafka

volumes:
postgres_data:
redis_data:
kafka_data:
infra/docker/init.sql:
sqlCREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

12. Kubernetes
    namespace + config + secrets
    infra/k8s/namespace.yaml:
    yamlapiVersion: v1
    kind: Namespace
    metadata:
    name: jake
    infra/k8s/configmap.yaml:
    yamlapiVersion: v1
    kind: ConfigMap
    metadata:
    name: jake-config
    namespace: jake
    data:
    NODE_ENV: "production"
    FRONTEND_URL: "https://app.jake.com"
    REDIS_URL: "redis://redis-service:6379"
    DATABASE_URL: "postgresql://jake:CHANGE_ME@postgres-service:5432/jake"
    KAFKA_BROKERS: "kafka-service:9092"
    KAFKA_GROUP_ID: "jake-api"
    infra/k8s/secrets.yaml:
    yamlapiVersion: v1
    kind: Secret
    metadata:
    name: jake-secrets
    namespace: jake
    type: Opaque
    stringData:
    JWT_SECRET: "your-jwt-secret"
    GOOGLE_CLIENT_ID: "your-google-client-id"
    GOOGLE_CLIENT_SECRET: "your-google-client-secret"
    ANTHROPIC_API_KEY: "your-anthropic-api-key"
    DEEPGRAM_API_KEY: "your-deepgram-api-key"
    ELEVENLABS_API_KEY: "your-elevenlabs-api-key"
    POSTGRES_PASSWORD: "your-postgres-password"
    API Deployment
    infra/k8s/api/deployment.yaml:
    yamlapiVersion: apps/v1
    kind: Deployment
    metadata:
    name: api
    namespace: jake
    spec:
    replicas: 2
    selector:
    matchLabels:
    app: api
    template:
    metadata:
    labels:
    app: api
    spec:
    containers:
    - name: api
    image: your-registry/jake-api:latest
    ports:
    - containerPort: 4000
    envFrom:
    - configMapRef:
    name: jake-config
    - secretRef:
    name: jake-secrets
    resources:
    requests:
    cpu: "250m"
    memory: "256Mi"
    limits:
    cpu: "1000m"
    memory: "512Mi"
    readinessProbe:
    httpGet:
    path: /health
    port: 4000
    initialDelaySeconds: 5
    periodSeconds: 10
    infra/k8s/api/service.yaml:
    yamlapiVersion: v1
    kind: Service
    metadata:
    name: api-service
    namespace: jake
    spec:
    selector:
    app: api
    ports:
    - port: 4000
      targetPort: 4000
      type: ClusterIP
      infra/k8s/api/hpa.yaml:
      yamlapiVersion: autoscaling/v2
      kind: HorizontalPodAutoscaler
      metadata:
      name: api-hpa
      namespace: jake
      spec:
      scaleTargetRef:
      apiVersion: apps/v1
      kind: Deployment
      name: api
      minReplicas: 2
      maxReplicas: 10
      metrics:
    - type: Resource
      resource:
      name: cpu
      target:
      type: Utilization
      averageUtilization: 70
      Worker Deployment
      infra/k8s/worker/deployment.yaml:
      yamlapiVersion: apps/v1
      kind: Deployment
      metadata:
      name: worker
      namespace: jake
      spec:
      replicas: 1
      selector:
      matchLabels:
      app: worker
      template:
      metadata:
      labels:
      app: worker
      spec:
      containers:
        - name: worker
          image: your-registry/jake-api:latest
          command: ["node", "dist/worker.js"]
          envFrom:
            - configMapRef:
              name: jake-config
            - secretRef:
              name: jake-secrets
              resources:
              requests:
              cpu: "250m"
              memory: "256Mi"
              limits:
              cpu: "1000m"
              memory: "512Mi"
              Web Deployment
              infra/k8s/web/deployment.yaml:
              yamlapiVersion: apps/v1
              kind: Deployment
              metadata:
              name: web
              namespace: jake
              spec:
              replicas: 2
              selector:
              matchLabels:
              app: web
              template:
              metadata:
              labels:
              app: web
              spec:
              containers:
        - name: web
          image: your-registry/jake-web:latest
          ports:
            - containerPort: 3000
              envFrom:
            - configMapRef:
              name: jake-config
              resources:
              requests:
              cpu: "100m"
              memory: "128Mi"
              limits:
              cpu: "500m"
              memory: "256Mi"
              Postgres StatefulSet
              infra/k8s/postgres/statefulset.yaml:
              yamlapiVersion: apps/v1
              kind: StatefulSet
              metadata:
              name: postgres
              namespace: jake
              spec:
              serviceName: postgres-service
              replicas: 1
              selector:
              matchLabels:
              app: postgres
              template:
              metadata:
              labels:
              app: postgres
              spec:
              containers:
        - name: postgres
          image: pgvector/pgvector:pg16
          ports:
            - containerPort: 5432
              env:
            - name: POSTGRES_USER
              value: jake
            - name: POSTGRES_PASSWORD
              valueFrom:
              secretKeyRef:
              name: jake-secrets
              key: POSTGRES_PASSWORD
            - name: POSTGRES_DB
              value: jake
              volumeMounts:
            - name: postgres-storage
              mountPath: /var/lib/postgresql/data
              resources:
              requests:
              cpu: "250m"
              memory: "512Mi"
              limits:
              cpu: "1000m"
              memory: "1Gi"
              volumeClaimTemplates:
    - metadata:
      name: postgres-storage
      spec:
      accessModes: ["ReadWriteOnce"]
      resources:
      requests:
      storage: 10Gi
      Kafka StatefulSet
      infra/k8s/kafka/statefulset.yaml:
      yamlapiVersion: apps/v1
      kind: StatefulSet
      metadata:
      name: kafka
      namespace: jake
      spec:
      serviceName: kafka-service
      replicas: 1
      selector:
      matchLabels:
      app: kafka
      template:
      metadata:
      labels:
      app: kafka
      spec:
      containers:
        - name: kafka
          image: bitnami/kafka:3.7
          ports:
            - containerPort: 9092
              env:
            - name: KAFKA_CFG_NODE_ID
              value: "0"
            - name: KAFKA_CFG_PROCESS_ROLES
              value: "controller,broker"
            - name: KAFKA_CFG_LISTENERS
              value: "PLAINTEXT://:9092,CONTROLLER://:9093"
            - name: KAFKA_CFG_CONTROLLER_QUORUM_VOTERS
              value: "0@kafka-0.kafka-service:9093"
            - name: KAFKA_CFG_CONTROLLER_LISTENER_NAMES
              value: "CONTROLLER"
            - name: KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP
              value: "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT"
              volumeMounts:
            - name: kafka-storage
              mountPath: /bitnami/kafka
              resources:
              requests:
              cpu: "250m"
              memory: "512Mi"
              limits:
              cpu: "500m"
              memory: "1Gi"
              volumeClaimTemplates:
    - metadata:
      name: kafka-storage
      spec:
      accessModes: ["ReadWriteOnce"]
      resources:
      requests:
      storage: 10Gi
      Ingress (WebSocket-ready)
      infra/k8s/ingress.yaml:
      yamlapiVersion: networking.k8s.io/v1
      kind: Ingress
      metadata:
      name: jake-ingress
      namespace: jake
      annotations:
      nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
      nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
      nginx.ingress.kubernetes.io/proxy-body-size: "50m"
      nginx.ingress.kubernetes.io/proxy-http-version: "1.1"
      nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      cert-manager.io/cluster-issuer: "letsencrypt-prod"
      spec:
      ingressClassName: nginx
      tls:
    - hosts:
        - app.jake.com
        - api.jake.com
          secretName: jake-tls
          rules:
    - host: app.jake.com
      http:
      paths:
      - path: /
      pathType: Prefix
      backend:
      service:
      name: web-service
      port:
      number: 3000
    - host: api.jake.com
      http:
      paths:
      - path: /
      pathType: Prefix
      backend:
      service:
      name: api-service
      port:
      number: 4000

13. CI/CD (GitHub Actions)
    .github/workflows/ci.yml:
    yamlname: CI
    on:
    push:
    branches: [main, develop]
    pull_request:
    branches: [main]

jobs:
check:
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v2
with: { version: 9 }
- uses: actions/setup-node@v4
with: { node-version: 20, cache: pnpm }
- run: pnpm install --frozen-lockfile
- run: pnpm turbo lint
- run: pnpm turbo type-check
- run: pnpm turbo build
.github/workflows/deploy.yml:
yamlname: Deploy
on:
push:
branches: [main]

env:
REGISTRY: ghcr.io
API_IMAGE: ghcr.io/${{ github.repository }}/api
WEB_IMAGE: ghcr.io/${{ github.repository }}/web

jobs:
build-and-push:
runs-on: ubuntu-latest
permissions:
contents: read
packages: write
steps:
- uses: actions/checkout@v4
- uses: docker/login-action@v3
with:
registry: ${{ env.REGISTRY }}
username: ${{ github.actor }}
password: ${{ secrets.GITHUB_TOKEN }}
- uses: docker/build-push-action@v5
with:
context: .
file: apps/api/Dockerfile
push: true
tags: ${{ env.API_IMAGE }}:${{ github.sha }},${{ env.API_IMAGE }}:latest
- uses: docker/build-push-action@v5
with:
context: .
file: apps/web/Dockerfile
push: true
tags: ${{ env.WEB_IMAGE }}:${{ github.sha }},${{ env.WEB_IMAGE }}:latest

deploy:
needs: build-and-push
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v4
- uses: azure/setup-kubectl@v3
- run: echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > $HOME/.kube/config
- run: |
kubectl set image deployment/api api=${{ env.API_IMAGE }}:${{ github.sha }} -n jake
kubectl set image deployment/web web=${{ env.WEB_IMAGE }}:${{ github.sha }} -n jake
kubectl set image deployment/worker worker=${{ env.API_IMAGE }}:${{ github.sha }} -n jake
- run: |
kubectl rollout status deployment/api -n jake --timeout=300s
kubectl rollout status deployment/web -n jake --timeout=300s

14. Quick Start
    bash# 1. Клонируй и установи
    git clone <repo> && cd jake
    pnpm install

# 2. Подними инфраструктуру
cd infra/docker && docker-compose up -d

# 3. Настрой env
cp apps/api/.env.example apps/api/.env
# Заполни: Google OAuth, Anthropic, Deepgram, ElevenLabs API ключи

# 4. Миграции + сид
pnpm db:migrate
pnpm db:seed    # Создаст Jake

# 5. Запуск
pnpm dev
# web → http://localhost:3000
# api → http://localhost:4000
# bull board → http://localhost:4000/admin/queues

15. Roadmap
    MVP (4-6 недель)

Google OAuth + регистрация
Первый урок с Jake (текстовый чат, без голоса)
Определение уровня через разговор
Память: факты + учебный профиль
Базовые упражнения (fill-the-gap, multiple choice)
Генерация домашки после урока

V1 (+ 4 недели)

Голос: Deepgram STT + ElevenLabs TTS
Выбор голоса
Spaced repetition для словаря
Дашборд прогресса
Kubernetes деплой

V2

Дополнительные персоны преподавателей
Анимированные аватарки
Push-уведомления
Мобильное приложение (React Native)
Групповые уроки