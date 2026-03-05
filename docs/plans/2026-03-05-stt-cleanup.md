# STT Cleanup: Remove Server-Side STT + Move Token to API

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove dead server-side STT code (Deepgram SDK, audio pipeline, audio WS event) and move the STT token endpoint from Next.js to NestJS API.

**Architecture:** Client-side STT stays unchanged (browser → Deepgram WebSocket). The token endpoint moves from Next.js API route to the existing `LessonController` in NestJS. The `exercise_answer` WS handler currently uses `processUserAudio` (with empty audio) as a non-streaming response+TTS pipeline — this logic gets inlined into `LessonMaintainer`.

**Tech Stack:** NestJS (Fastify), Next.js, Socket.IO

---

### Task 1: Delete server-side STT infrastructure

**Files:**
- Delete: `apps/api/src/@lib/provider/src/stt-provider.ts`
- Delete: `apps/api/src/@lib/deepgram/src/deepgram.module.ts`
- Delete: `apps/api/src/@lib/deepgram/src/index.ts`
- Delete: `apps/api/src/@shared/shared-deepgram/shared-deepgram.module.ts`
- Delete: `apps/api/src/@logic/voice/src/deepgram-stt.provider.ts`
- Delete: `apps/api/src/@logic/voice/src/voice.types.ts`
- Modify: `apps/api/src/@lib/provider/src/index.ts` (remove `SttProvider` export)

**Step 1: Delete the 6 files listed above**

**Step 2: Remove `SttProvider` export from provider index**

In `apps/api/src/@lib/provider/src/index.ts`, remove line 4:
```typescript
export { SttProvider } from "./stt-provider";
```

Result:
```typescript
export { LlmProvider } from "./llm-provider";
export type { LlmMessage, LlmResponse, LlmStreamCallbacks } from "./llm-provider";
export { EmbeddingProvider } from "./embedding-provider";
export { TtsProvider } from "./tts-provider";
```

**Step 3: Verify no remaining imports of deleted modules**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && grep -r "SttProvider\|DeepgramSttProvider\|SharedDeepgramModule\|DeepgramModule\|DEEPGRAM_CLIENT\|deepgram-stt\|stt-provider\|shared-deepgram\|@lib/deepgram\|voice\.types" apps/api/src --include="*.ts" -l`

Expected: only files we'll modify in later tasks (voice.module.ts, audio-pipeline.service.ts, lesson.gateway.ts, lesson.module.ts, lesson.maintainer.ts)

---

### Task 2: Remove AudioPipelineService and update VoiceModule

**Files:**
- Delete: `apps/api/src/@logic/lesson/application/service/audio-pipeline.service.ts`
- Delete: `apps/api/src/@logic/lesson/presentation/dto/ws/ws-audio-message.ts`
- Modify: `apps/api/src/@logic/voice/src/voice.module.ts`

**Step 1: Delete `audio-pipeline.service.ts` and `ws-audio-message.ts`**

**Step 2: Rewrite `voice.module.ts` — remove STT provider, keep only TTS**

```typescript
import { Module } from "@nestjs/common";
import { ElevenLabsTtsProvider } from "./elevenlabs-tts.provider";
import { SharedConfigModule } from "../../../@shared/shared-config/shared-config.module";
import { EnvService } from "../../../@shared/shared-config/env.service";
import { TtsProvider } from "../../../@lib/provider/src";

@Module({
  imports: [SharedConfigModule],
  providers: [
    {
      provide: TtsProvider,
      inject: [EnvService],
      useFactory: (env: EnvService) => new ElevenLabsTtsProvider(env),
    },
  ],
  exports: [TtsProvider],
})
export class VoiceModule {}
```

**Step 3: Verify**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm type-check`
Expected: errors only in lesson.gateway.ts and lesson.maintainer.ts (next tasks)

---

### Task 3: Remove `audio` WS event + refactor `exercise_answer` in gateway and maintainer

The `exercise_answer` handler currently calls `processUserAudio("", ...)` which goes through `AudioPipelineService` skipping STT, just doing LLM response + TTS. We replace this with a new `processExerciseAnswer` method on `LessonMaintainer` that does the same thing directly.

**Files:**
- Modify: `apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts`
- Modify: `apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts`
- Modify: `apps/api/src/@logic/lesson/lesson.module.ts`

**Step 1: Add `processExerciseAnswer` to `LessonMaintainer` and remove `processUserAudio`**

In `lesson.maintainer.ts`:

1. Remove `AudioPipelineService` import (line 6) and constructor param (line 47: `private audioPipeline: AudioPipelineService`)

2. Remove entire `processUserAudio` method (lines 129-165)

3. Add new method after `startLesson`:

```typescript
async processExerciseAnswer(
  lessonId: string,
  userId: string,
  systemPrompt: string,
  history: LlmMessage[],
  voiceId: string,
  speechSpeed?: number,
) {
  const response = await this.responseService.generate(systemPrompt, history);

  let audio = "";
  try {
    audio = await this.tts.synthesize(response.text, voiceId, speechSpeed);
  } catch (error) {
    this.logger.warn(`TTS failed for exercise feedback: ${error instanceof Error ? error.message : String(error)}`);
  }

  await this.messageRepository.create({ lessonId, role: "tutor", content: response.text });

  await this.factQueue.add("extract", {
    userId,
    lessonId,
    userMessage: history[history.length - 1]?.content ?? "",
    history,
  });

  return { tutorText: response.text, tutorAudio: audio };
}
```

**Step 2: Update `lesson.gateway.ts`**

1. Remove `wsAudioMessageSchema` import (line 17)

2. Remove entire `handleAudio` method (lines 109-153)

3. Replace `handleExerciseAnswer` method (lines 213-255) with:

```typescript
@SubscribeMessage("exercise_answer")
async handleExerciseAnswer(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: unknown,
) {
  const parsed = wsExerciseAnswerSchema.safeParse(data);
  if (!parsed.success) {
    client.emit("error", { message: "Invalid exercise answer" });
    return;
  }

  const session = await this.sessionService.get(client.id);
  if (!session) return;

  const userId = (client.data as SocketData).userId;

  await this.sessionService.appendHistory(client.id, {
    role: "user",
    content: `[Exercise answer: ${parsed.data.answer}]`,
  });

  const updatedSession = await this.sessionService.get(client.id);
  if (!updatedSession) return;

  const result = await this.lessonMaintainer.processExerciseAnswer(
    updatedSession.lessonId,
    userId,
    updatedSession.systemPrompt,
    updatedSession.history,
    updatedSession.voiceId,
    updatedSession.speechSpeed,
  );

  await this.sessionService.appendHistory(client.id, {
    role: "assistant",
    content: result.tutorText,
  });

  client.emit("exercise_feedback", {
    text: result.tutorText,
    audio: result.tutorAudio,
  });
}
```

**Step 3: Update `lesson.module.ts`**

Remove `AudioPipelineService` import (line 8) and remove it from providers array (line 56).

**Step 4: Verify**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm type-check`
Expected: PASS

---

### Task 4: Add STT token endpoint to NestJS API

**Files:**
- Modify: `apps/api/src/@logic/lesson/presentation/controller/lesson.controller.ts`

**Step 1: Add `GET stt/token` endpoint to `LessonController`**

Add import for `EnvService`:
```typescript
import { EnvService } from "../../../../@shared/shared-config/env.service";
```

Add `EnvService` to constructor:
```typescript
constructor(
  private lessonMaintainer: LessonMaintainer,
  private env: EnvService,
) {}
```

Add rate limit map and endpoint method after `sttMetrics`:

```typescript
private sttTokenHits = new Map<string, { count: number; resetAt: number }>();

@Get("stt/token")
async sttToken(@CurrentUserId() userId: string) {
  // Rate limit: 10 requests per 10 minutes per user
  const now = Date.now();
  const entry = this.sttTokenHits.get(userId);

  if (entry && now < entry.resetAt) {
    entry.count++;
    if (entry.count > 10) {
      throw new HttpException("Too many requests", 429);
    }
  } else {
    this.sttTokenHits.set(userId, { count: 1, resetAt: now + 10 * 60 * 1000 });
  }

  const apiKey = this.env.get("DEEPGRAM_API_KEY");
  if (!apiKey) {
    throw new HttpException("DEEPGRAM_API_KEY not configured", 500);
  }

  // Attempt short-lived token via Deepgram grant API
  const grantRes = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: 300 }),
  }).catch(() => null);

  if (grantRes?.ok) {
    const data = (await grantRes.json()) as { access_token: string };
    return { key: data.access_token };
  }

  return { key: apiKey };
}
```

Add `HttpException` to the `@nestjs/common` import.

**Step 2: Add `SharedConfigModule` import to `lesson.module.ts`**

```typescript
import { SharedConfigModule } from "../../@shared/shared-config/shared-config.module";
```

Add to imports array:
```typescript
imports: [
  // ... existing
  SharedConfigModule,
],
```

**Step 3: Verify**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm type-check`
Expected: PASS

---

### Task 5: Update frontend to use new API token endpoint

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/hooks/useStudentStt.ts`
- Delete: `apps/web/src/app/api/stt/token/route.ts`

**Step 1: Add `token` method to `api.stt` in `api.ts`**

```typescript
stt: {
  token: () => request<{ key: string }>("/lessons/stt/token"),
  metrics: (data: { durationMs: number; transcriptLength: number; segments: number }) =>
    request<{ success: boolean }>("/lessons/stt/metrics", {
      method: "POST",
      body: JSON.stringify(data),
    }),
},
```

**Step 2: Update `useStudentStt.ts` to use `api.stt.token()`**

Replace lines 102-104:
```typescript
const tokenRes = await fetch("/api/stt/token");
if (!tokenRes.ok) throw new Error("Failed to get STT token");
const { key } = (await tokenRes.json()) as { key: string };
```

With:
```typescript
const { key } = await api.stt.token();
```

**Step 3: Delete `apps/web/src/app/api/stt/token/route.ts`**

Also check if the parent `stt/` directory has any other files. If empty after deletion, delete the directory too.

**Step 4: Delete `apps/web/src/lib/rate-limit.ts`**

Check if it's used anywhere else first:
Run: `grep -r "rate-limit" apps/web/src --include="*.ts" -l`
If only used in the deleted route, delete it.

**Step 5: Verify**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm type-check`
Expected: PASS

---

### Task 6: Update nginx and Next.js dev proxy

**Files:**
- Modify: `infra/nginx.conf`
- Modify: `apps/web/next.config.js`

**Step 1: Remove `/api/stt/` location block from nginx.conf**

Delete lines 39-45 (the `/api/stt/` location block). The `/api/*` catch-all will now route STT requests to NestJS API.

**Step 2: Update Next.js rewrite to stop excluding `/api/stt/`**

In `apps/web/next.config.js` line 39, change:
```javascript
source: "/api/:path((?!auth|stt).*)",
```
To:
```javascript
source: "/api/:path((?!auth).*)",
```

This allows `/api/stt/*` requests to be proxied to NestJS in dev mode.

---

### Task 7: Remove `@deepgram/sdk` package dependency

**Step 1: Uninstall the package**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/api remove @deepgram/sdk`

**Step 2: Verify no remaining imports**

Run: `grep -r "@deepgram/sdk" apps/ --include="*.ts" -l`
Expected: no results

---

### Task 8: Final verification

**Step 1: Type-check**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm type-check`
Expected: PASS

**Step 2: Lint**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm lint`
Expected: PASS

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove server-side STT, move token endpoint to API

- Delete DeepgramSttProvider, AudioPipelineService, audio WS event handler
- Delete @lib/deepgram, @shared/shared-deepgram, SttProvider abstract class
- Move GET /api/stt/token from Next.js to NestJS LessonController
- Refactor exercise_answer to use new processExerciseAnswer method
- Update nginx and Next.js dev proxy to route /api/stt/* to API
- Remove @deepgram/sdk dependency

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
