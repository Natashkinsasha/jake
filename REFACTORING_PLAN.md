# Рефакторинг jake API по паттернам node-challenge-task

## Context

Текущий jake API и node-challenge-task используют одинаковый стек (NestJS + Fastify, Drizzle, Zod, Bull), но jake имеет:
- Повсеместный `any` в контроллерах, маппер'ах, сервисах
- Нет валидации WS-сообщений
- Модели типов через `typeof table.$inferInsert` вместо `z.infer<typeof schema>`
- Контроллеры используют `@Req() req: any` вместо типобезопасного извлечения userId
- Дыра в безопасности: progress и vocabulary берут userId из query-параметра
- Непоследовательная обработка ошибок (`throw new Error` вместо NestJS exceptions)
- Body DTO определены как raw Zod-типы, а не `createZodDto` классы

Цель: привести к паттернам node-challenge-task — типобезопасность, валидация, единообразие.

---

## Phase 0: Shared Infrastructure

### 0.1 Установить `nestjs-zod`
```
cd apps/api && pnpm add nestjs-zod
```

### 0.2 Обновить SharedZodHttpModule
**Файл:** `@shared/shared-zod-http/shared-zod-http.module.ts`
- Заменить кастомный `ZodValidationPipe` на `ZodValidationPipe` из `nestjs-zod`
- Добавить `ZodSerializerInterceptor` как `APP_INTERCEPTOR` (для `@ZodResponse`)
- Заменить `ZodExceptionFilter` на `HttpExceptionFilter` (extends `BaseExceptionFilter`)

**Файл:** `@shared/shared-zod-http/zod-exception.filter.ts` → переименовать в `http-exception.filter.ts`
- Заменить содержимое на: `@Catch() export class HttpExceptionFilter extends BaseExceptionFilter { catch(e, host) { super.catch(e, host); } }`

**Удалить:** `@shared/shared-zod-http/zod-validation.pipe.ts`

### 0.3 Создать `@CurrentUser()` декоратор
**Новый файл:** `@shared/shared-auth/current-user.decorator.ts`
```typescript
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user.sub;
  },
);
```

### 0.4 Исправить все model-файлы: `typeof table.$infer*` → `z.infer<typeof schema>`
**14 файлов** — заменить паттерн `export type X = typeof table.$inferInsert/Select` на `export type X = z.infer<typeof schema>` + добавить `import { z } from "zod"`:

- `@logic/auth/infrastructure/model/insert-user.ts`
- `@logic/auth/infrastructure/model/select-user.ts`
- `@logic/tutor/infrastructure/model/select-tutor.ts`
- `@logic/lesson/infrastructure/model/insert-lesson.ts`
- `@logic/lesson/infrastructure/model/select-lesson.ts`
- `@logic/lesson/infrastructure/model/insert-lesson-message.ts`
- `@logic/homework/infrastructure/model/insert-homework.ts`
- `@logic/homework/infrastructure/model/select-homework.ts`
- `@logic/memory/infrastructure/model/insert-memory-fact.ts`
- `@logic/memory/infrastructure/model/select-memory-fact.ts`
- `@logic/memory/infrastructure/model/insert-memory-embedding.ts`
- `@logic/vocabulary/infrastructure/model/insert-vocabulary.ts`
- `@logic/vocabulary/infrastructure/model/select-vocabulary.ts`
- `@logic/progress/infrastructure/model/insert-grammar-progress.ts`
- `@logic/progress/infrastructure/model/select-grammar-progress.ts`

### 0.5 Исправить composite model-файлы
**`@logic/auth/infrastructure/model/select-user-with-preferences.ts`** — заменить `typeof table.$inferSelect` на импорты `SelectUser` и `SelectUserPreference`

**`@logic/lesson/infrastructure/model/select-lesson-with-tutor.ts`** — заменить на импорты `SelectLesson` и `SelectTutor`

---

## Phase 1: Tutor (простой модуль)

### 1.1 Маппер: `any` → `SelectTutor`
**Файл:** `@logic/tutor/application/mapper/tutor.mapper.ts`
- `toResponse(tutor: any)` → `toResponse(tutor: SelectTutor)`

### 1.2 Response DTO: interface → createZodDto
**Файл:** `@logic/tutor/presentation/dto/response/tutor-list.response.ts`
- Конвертировать interface в `createZodDto` класс

### 1.3 Controller: добавить `@ZodResponse`
**Файл:** `@logic/tutor/presentation/controller/tutor.controller.ts`
- Добавить `@ZodResponse({ type: TutorListResponse })` к методу `list()`

---

## Phase 2: Progress (security fix)

### 2.1 Controller: `@Query("userId")` → `@CurrentUser()`
**Файл:** `@logic/progress/presentation/controller/progress.controller.ts`
- Заменить `@Query("userId") userId: string` на `@CurrentUser() userId: string`

### 2.2 Response DTO: interface → createZodDto
**Файл:** `@logic/progress/presentation/dto/response/progress-overview.response.ts`

---

## Phase 3: Vocabulary (security fix)

### 3.1 Controller: `@Query("userId")` → `@CurrentUser()`
**Файл:** `@logic/vocabulary/presentation/controller/vocabulary.controller.ts`
- Оба метода `list()` и `getForReview()`: заменить `@Query("userId")` на `@CurrentUser()`

### 3.2 Response DTO: interface → createZodDto
**Файл:** `@logic/vocabulary/presentation/dto/response/vocabulary-list.response.ts`

---

## Phase 4: Auth

### 4.1 Создать UpdatePreferencesBody DTO
**Новый файл:** `@logic/auth/presentation/dto/body/update-preferences.body.ts`
- Схема повторяет поля из `UserDao.updatePreferences` (correctionStyle, explainGrammar, speakingSpeed, useNativeLanguage, preferredExerciseTypes, interests)
- `createZodDto` + все поля `.optional()`

### 4.2 Controller: `@Req() req: any` → `@CurrentUser()`
**Файл:** `@logic/auth/presentation/controller/auth.controller.ts`
- `getProfile`: `@Req() req: any` → `@CurrentUser() userId: string`
- `updatePreferences`: `@Req() req: any, @Body() body: any` → `@CurrentUser() userId: string, @Body() body: UpdatePreferencesBody`

### 4.3 GoogleAuthBody: raw Zod type → createZodDto
**Файл:** `@logic/auth/presentation/dto/body/google-auth.body.ts`
- `export type` → `export class extends createZodDto(...)`

### 4.4 AuthTokenResponse: interface → createZodDto
**Файл:** `@logic/auth/presentation/dto/response/auth-token.response.ts`

### 4.5 AuthMaintainer: fix `any` types
**Файл:** `@logic/auth/application/maintainer/auth.maintainer.ts`
- `googleAuth(googleUser: { inline... })` → `googleAuth(googleUser: GoogleAuthBody)`
- `updatePreferences(userId: string, data: any)` → `updatePreferences(userId: string, data: UpdatePreferencesBody)`

---

## Phase 5: Homework

### 5.1 Controller: `@Req() req: any` → `@CurrentUser()`
**Файл:** `@logic/homework/presentation/controller/homework.controller.ts`
- `listHomework`: `@Req() req: any` → `@CurrentUser() userId: string`
- `submit`: `@Body() body: { answers: ... }` → `@Body() body: SubmitHomeworkBody`

### 5.2 SubmitHomeworkBody: raw Zod type → createZodDto
**Файл:** `@logic/homework/presentation/dto/body/submit-homework.body.ts`

### 5.3 HomeworkDetailResponse: interface → createZodDto
**Файл:** `@logic/homework/presentation/dto/response/homework-detail.response.ts`

### 5.4 HomeworkMaintainer: fix error handling
**Файл:** `@logic/homework/application/maintainer/homework.maintainer.ts`
- `throw new Error("Homework not found")` → `throw new NotFoundException("Homework not found")`

### 5.5 HomeworkMapper: `any` → `SelectHomework`
**Файл:** `@logic/homework/application/mapper/homework.mapper.ts`

### 5.6 HomeworkGeneratorService: fix `any` params
**Файл:** `@logic/homework/application/service/homework-generator.service.ts`
- Определить inline интерфейсы `LessonSummary` и `UserPreferences` для параметров `summary` и `preferences`

### 5.7 HomeworkCheckerService: fix `any[]`
**Файл:** `@logic/homework/application/service/homework-checker.service.ts`
- `exercises: any[]` → `exercises: Array<{ id: string; correctAnswer: string | string[] }>`

---

## Phase 6: Memory (нет контроллера)

### 6.1 MemoryMaintainer: `any[]` → `LlmMessage[]`
**Файл:** `@logic/memory/application/maintainer/memory.maintainer.ts`
- `history: any[]` → `history: LlmMessage[]` (импорт из `@lib/llm`)

---

## Phase 7: Lesson (самый сложный модуль)

### 7.1 Controller: `@Req() req: any` → `@CurrentUser()`
**Файл:** `@logic/lesson/presentation/controller/lesson.controller.ts`
- `listLessons`: `@Req() req: any` → `@CurrentUser() userId: string`
- `endLesson`: `@Body() body: { history: any[] }` → `@Body() body: EndLessonBody`

### 7.2 EndLessonBody: raw Zod type → createZodDto
**Файл:** `@logic/lesson/presentation/dto/body/end-lesson.body.ts`

### 7.3 LessonSummaryResponse: interface → createZodDto
**Файл:** `@logic/lesson/presentation/dto/response/lesson-summary.response.ts`

### 7.4 LessonMapper: `any` → `SelectLesson`
**Файл:** `@logic/lesson/application/mapper/lesson.mapper.ts`

### 7.5 WS DTO: добавить Zod-схемы для валидации
**Файлы:**
- `@logic/lesson/presentation/dto/ws/ws-audio-message.ts` — добавить `wsAudioMessageSchema = z.object({ audio: z.string().min(1) })`
- `@logic/lesson/presentation/dto/ws/ws-exercise-answer.ts` — добавить `wsExerciseAnswerSchema = z.object({ exerciseId: z.string(), answer: z.string() })`

(Оставить интерфейсы для `ws-tutor-message.ts` и `ws-lesson-event.ts` — это исходящие сообщения, валидация не нужна)

### 7.6 LessonGateway: добавить WS-валидацию
**Файл:** `@logic/lesson/presentation/gateway/lesson.gateway.ts`
- `handleAudio`: `@MessageBody() data: { audio: string }` → `@MessageBody() data: unknown` + `safeParse`
- `handleText`: аналогично — добавить `wsTextMessageSchema` + `safeParse`
- `handleExerciseAnswer`: аналогично — `wsExerciseAnswerSchema` + `safeParse`

### 7.7 Fix error handling в сервисах
**`@logic/lesson/application/service/lesson-context.service.ts`:**
- `throw new Error("User or tutor not found")` → `throw new NotFoundException(...)`

**`@logic/lesson/application/service/audio-pipeline.service.ts`:**
- `throw new Error("Could not understand...")` → `throw new BadRequestException(...)`

### 7.8 PostLessonBullHandler: fix `any` types
**Файл:** `@logic/lesson/infrastructure/bull-handler/post-lesson.bull-handler.ts`
- Определить `PostLessonSummary` interface для `llm.generateJson<PostLessonSummary>(...)`
- `(m: any)` → `(m: { role: string; content: string })`

---

## Phase 8: Финальная верификация

```bash
cd apps/api && pnpm type-check
```

Проверить, что:
1. `tsc --noEmit` проходит без ошибок
2. Приложение стартует: `pnpm dev`
3. Нет регрессий в WS-соединениях

---

## Сводка изменений

| Категория | Кол-во файлов |
|-----------|--------------|
| Новые файлы | 2 (CurrentUser decorator, UpdatePreferencesBody) |
| Удалить | 1 (zod-validation.pipe.ts) |
| Переименовать | 1 (zod-exception.filter → http-exception.filter) |
| Model-файлы (z.infer fix) | ~15 |
| Controllers (CurrentUser + ZodResponse) | 6 |
| Body DTOs (type → createZodDto) | 4 |
| Response DTOs (interface → createZodDto) | 5 |
| Mappers (any → typed) | 3 |
| Services/Maintainers (any → typed) | ~6 |
| WS validation | 3 |
| **Итого** | ~46 файлов |

## Что НЕ меняем

- CLS/Transaction подход (у jake свой AsyncLocalStorage, миграция на @nestjs-cls/transactional — отдельная задача)
- DAO injection pattern (jake: `@Inject(DRIZZLE) db`, challenge: `txHost`)
- EnvService (у jake типобезопаснее чем ConfigService в challenge)
- Не добавляем service layer в простые модули (Progress, Vocabulary)
