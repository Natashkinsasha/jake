# Session Persistence Across Reconnects

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep lesson sessions alive across WebSocket reconnects/server restarts so students resume their lesson instead of starting a new one.

**Architecture:** Change Redis session key from `socket.id` to `userId`. On connect, check for existing session — if found, emit `lesson_resumed` with history. `handleDisconnect` no longer ends the lesson. Only explicit `end_lesson` event (or TTL expiry) ends a lesson.

**Tech Stack:** NestJS (Socket.IO gateway), Redis (ioredis), React (Socket.IO client)

---

### Task 1: Rekey LessonSessionService from socketId to userId

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/service/lesson-session.service.ts`

**Step 1: Update all method signatures from `socketId` to `userId`**

Change every method parameter from `socketId: string` to `userId: string`. The Redis key stays `lesson:session:{userId}`. No logic changes needed — just the parameter name and semantics.

```typescript
async save(userId: string, session: LessonSession): Promise<void> {
  await this.redis.set(
    KEY_PREFIX + userId,
    JSON.stringify(session),
    "EX",
    SESSION_TTL,
  );
}

async get(userId: string): Promise<LessonSession | null> {
  const data = await this.redis.get(KEY_PREFIX + userId);
  if (!data) return null;
  try {
    return JSON.parse(data) as LessonSession;
  } catch {
    this.logger.warn(`Failed to parse session for user ${userId}`);
    return null;
  }
}

async delete(userId: string): Promise<void> {
  await this.redis.del(KEY_PREFIX + userId);
}

async updateSpeechSpeed(userId: string, speed: number): Promise<void> {
  const session = await this.get(userId);
  if (!session) return;
  session.speechSpeed = speed;
  await this.save(userId, session);
}

async setVoiceMismatch(userId: string, mismatch: boolean): Promise<void> {
  const session = await this.get(userId);
  if (!session) return;
  session.voiceMismatch = mismatch;
  await this.save(userId, session);
}

async appendHistory(userId: string, ...messages: LlmMessage[]): Promise<void> {
  const session = await this.get(userId);
  if (!session) return;
  session.history.push(...messages);
  await this.save(userId, session);
}
```

**Step 2: Verify no tests break**

Run: `pnpm --filter @jake/api test`

**Step 3: Commit**

```bash
git add apps/api/src/@logic/lesson/application/service/lesson-session.service.ts
git commit -m "refactor(api): rekey lesson session from socketId to userId"
```

---

### Task 2: Update LessonGateway to use userId-keyed sessions

**Files:**
- Modify: `apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts`

**Step 1: Update handleConnection to check for existing session**

Replace current `handleConnection` logic. After JWT verification, check if session exists for `userId`:
- If yes → emit `lesson_resumed` with session data (history, voiceId, speed, lessonId, etc.)
- If no → call `startLesson` and create session as before

```typescript
async handleConnection(client: Socket) {
  const token =
    (client.handshake.auth as Record<string, unknown>)["token"] ??
    client.handshake.query["token"];

  if (token == null) {
    client.emit("error", { message: "No auth token" });
    client.disconnect();
    return;
  }

  let userId: string;
  try {
    const payload = await this.jwtService.verifyAsync<{ sub: string }>(token as string);
    userId = payload.sub;
    (client.data as SocketData) = { userId };
  } catch {
    client.emit("error", { message: "Invalid token" });
    client.disconnect();
    return;
  }

  try {
    const existingSession = await this.sessionService.get(userId);

    if (existingSession) {
      this.logger.log(`Resuming lesson ${existingSession.lessonId} for user ${userId}`);

      const history = existingSession.history.map((msg) => ({
        role: msg.role as "user" | "assistant",
        text: msg.content,
      }));

      client.emit("lesson_resumed", {
        lessonId: existingSession.lessonId,
        voiceId: existingSession.voiceId,
        speechSpeed: existingSession.speechSpeed,
        isOnboarding: existingSession.isOnboarding ?? false,
        history,
      });
      return;
    }

    const result = await this.lessonMaintainer.startLesson(userId);

    await this.sessionService.save(userId, {
      lessonId: result.lessonId,
      systemPrompt: result.systemPrompt,
      voiceId: result.voiceId,
      speechSpeed: result.speechSpeed,
      history: [{ role: "assistant", content: result.greeting.text }],
      isOnboarding: result.isOnboarding,
    });

    client.emit("lesson_started", {
      lessonId: result.lessonId,
      voiceId: result.voiceId,
      speechSpeed: result.speechSpeed,
      ttsModel: result.ttsModel,
      systemPrompt: result.systemPrompt,
      emotion: result.greeting.emotion,
      isOnboarding: result.isOnboarding,
    });

    client.emit("tutor_chunk", { chunkIndex: 0, text: result.greeting.text });
    client.emit("tutor_stream_end", { fullText: result.greeting.text });
  } catch (error: unknown) {
    this.logger.error(`Failed to start lesson: ${error instanceof Error ? error.message : String(error)}`);
    client.emit("error", { message: "Failed to start lesson" });
    client.disconnect();
  }
}
```

**Step 2: Update handleDisconnect — don't end lesson**

Only clean up in-memory maps. Don't call `endLesson` or delete session.

```typescript
async handleDisconnect(client: Socket) {
  this.abortControllers.get(client.id)?.abort();
  this.abortControllers.delete(client.id);
  this.sentChunksText.delete(client.id);
  this.pendingUserText.delete(client.id);
  // Session stays in Redis — lesson continues on reconnect
}
```

**Step 3: Update all sessionService calls to use userId instead of client.id**

Every place that calls `this.sessionService.*(client.id, ...)` needs to change to `this.sessionService.*((client.data as SocketData).userId, ...)`. This includes:
- `handleText`: `sessionService.appendHistory`, `sessionService.get` (inside `processTextMessageStreaming`)
- `handleInterrupt`: `sessionService.appendHistory`
- `handleSetSpeed`: `sessionService.get`, `sessionService.updateSpeechSpeed`
- `handleVoiceSample`: `sessionService.setVoiceMismatch`
- `handleEndLesson`: `sessionService.get`, `sessionService.delete`

Helper to reduce repetition:

```typescript
private getUserId(client: Socket): string {
  return (client.data as SocketData).userId;
}
```

**Step 4: Verify no tests break**

Run: `pnpm --filter @jake/api test`

**Step 5: Commit**

```bash
git add apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts
git commit -m "feat(api): persist lesson session across reconnects

Session keyed by userId instead of socketId. Disconnect no longer
ends the lesson. Reconnect resumes existing session with history."
```

---

### Task 3: Update LessonMaintainer calls that pass socketId

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts`

**Step 1: Check if `processTextMessageStreaming` uses socketId for session calls**

The maintainer receives `socketId` as first param and uses it for `sessionService.get(socketId)` and `sessionService.appendHistory(socketId, ...)`. Change this parameter to `userId`.

Update the method signature:
```typescript
async processTextMessageStreaming(
  userId: string,  // was socketId
  // ... rest stays the same
)
```

And update all `sessionService` calls inside to use `userId`.

**Step 2: Update gateway call site**

In `lesson.gateway.ts`, update the `handleText` call:
```typescript
await this.lessonMaintainer.processTextMessageStreaming(
  this.getUserId(client),  // was client.id
  userId,
  parsed.data.text,
  // ...callbacks...
);
```

**Step 3: Run tests**

Run: `pnpm --filter @jake/api test`

**Step 4: Commit**

```bash
git add apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts
git commit -m "refactor(api): pass userId instead of socketId to maintainer"
```

---

### Task 4: Handle `lesson_resumed` on frontend

**Files:**
- Modify: `apps/web/src/hooks/useLessonState.ts`
- Modify: `apps/web/src/hooks/useWebSocket.ts`

**Step 1: Add `lesson_resumed` to WebSocket event list**

In `useWebSocket.ts`, add `"lesson_resumed"` to the `events` array:

```typescript
const events = [
  "lesson_started", "lesson_resumed", "tutor_message", "transcript",
  // ...rest
];
```

**Step 2: Handle `lesson_resumed` in `useLessonState.ts`**

In the `handleEvent` callback, add handling before the `handleLessonEvent` call:

```typescript
if (event === "lesson_resumed") {
  const d = data as LessonEventData & {
    lessonId?: string;
    voiceId?: string;
    speechSpeed?: number;
    isOnboarding?: boolean;
    history?: Array<{ role: "user" | "assistant"; text: string }>;
  };
  if (d.voiceId) voiceIdRef.current = d.voiceId;
  if (d.speechSpeed != null) speechSpeedRef.current = d.speechSpeed;

  const messages: ChatMessage[] = (d.history ?? []).map((msg) => ({
    role: msg.role,
    text: msg.text,
    timestamp: Date.now(),
  }));

  setState({
    lessonId: d.lessonId ?? null,
    messages,
    status: "idle",
    lessonEnded: false,
    error: null,
  });
  return;
}
```

**Step 3: Run tests**

Run: `pnpm --filter @jake/web test`

**Step 4: Commit**

```bash
git add apps/web/src/hooks/useLessonState.ts apps/web/src/hooks/useWebSocket.ts
git commit -m "feat(web): handle lesson_resumed event to restore chat history"
```

---

### Task 5: Type-check and lint

**Step 1: Run full type-check**

Run: `pnpm type-check`

**Step 2: Run lint**

Run: `pnpm lint`

**Step 3: Fix any issues**

**Step 4: Commit fixes if any**

```bash
git commit -m "fix: resolve type-check and lint issues"
```
