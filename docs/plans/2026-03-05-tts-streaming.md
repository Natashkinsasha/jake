# Client-Side TTS Streaming Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move TTS from server-side (ElevenLabsTtsProvider on NestJS) to client-side (browser connects directly to ElevenLabs WebSocket), eliminating server TTS overhead and mirroring the existing client-side STT architecture.

**Architecture:** Server sends text-only events (no audio). Client fetches a single-use ElevenLabs token, opens a WebSocket to `wss://api.elevenlabs.io`, sends text sentences (one per server `tutor_chunk`), and plays received audio chunks via a queue. Text displays immediately; audio plays in background without text-audio sync.

**Tech Stack:** ElevenLabs WebSocket Streaming API, single-use tokens, `useAudioQueue` (existing), Socket.IO, NestJS

---

## Context

Currently the server-side `StreamingPipelineService` splits Claude's streaming output into sentences, calls `TtsProvider.synthesize()` per sentence (ElevenLabs HTTP API), and emits `tutor_chunk { chunkIndex, text, audio }` via Socket.IO. The client's `useAudioQueue` plays MP3 base64 chunks in order, syncing text reveal with audio playback.

After this refactor:
- Server sends `tutor_chunk { chunkIndex, text }` (no `audio`)
- `lesson_started` includes `voiceId` and `speechSpeed`
- Client opens one ElevenLabs WS per tutor response, sends sentences with `flush: true`, plays audio as it arrives
- `useAudioQueue` is adapted to accept raw audio bytes from ElevenLabs WS

### ElevenLabs WebSocket Protocol

**Single-use token:** `POST https://api.elevenlabs.io/v1/single-use-token/tts_websocket` with body `{ "allowed_voice_ids": ["voiceId"] }`. Returns `{ "token": "xxx" }`. Token is consumed when WS connects. Valid 15 min.

**WS URL:** `wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id=eleven_turbo_v2_5&output_format=mp3_22050_32`

**Init message:** `{ "text": " ", "voice_settings": { "stability": 0.5, "similarity_boost": 0.75, "style": 0.3 }, "xi_api_key": "<token>", "generation_config": { "chunk_length_schedule": [120] } }`

**Text message:** `{ "text": "Hello world. ", "flush": true }` — flush forces immediate generation.

**EOS:** `{ "text": "" }` — closes the stream.

**Response:** `{ "audio": "<base64>", "isFinal": false }` — MP3 chunks. `isFinal: true` on last chunk.

### Audio Playback Strategy

One ElevenLabs WS per tutor response. Sentences are sent with `flush: true`. Between sending sentence N and sentence N+1, all received audio belongs to sentence N. We collect those chunks, concatenate into one base64 string, and enqueue in `useAudioQueue` (per-sentence playback, same as current approach). Text displays immediately without audio sync.

---

### Task 1: Add TTS Token Endpoint to API

**Files:**
- Modify: `apps/api/src/@logic/lesson/presentation/controller/lesson.controller.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/config.ts`

**Step 1: Add `GET /lessons/tts/token` endpoint**

In `apps/api/src/@logic/lesson/presentation/controller/lesson.controller.ts`, add a new route (before `:id` route) that:
- Rate-limits per user (10 req / 10 min, same pattern as `sttToken`)
- Reads `ELEVENLABS_API_KEY` from env
- Calls `POST https://api.elevenlabs.io/v1/single-use-token/tts_websocket` with header `xi-api-key: <key>` and body `{ "allowed_voice_ids": ["*"] }`
- Returns `{ token: string }`

```typescript
private ttsTokenHits = new Map<string, { count: number; resetAt: number }>();

@Get("tts/token")
async ttsToken(@CurrentUserId() userId: string) {
  const now = Date.now();
  const entry = this.ttsTokenHits.get(userId);

  if (entry && now < entry.resetAt) {
    entry.count++;
    if (entry.count > 10) {
      throw new HttpException("Too many requests", 429);
    }
  } else {
    this.ttsTokenHits.set(userId, { count: 1, resetAt: now + 10 * 60 * 1000 });
  }

  const apiKey = this.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    throw new HttpException("ELEVENLABS_API_KEY not configured", 500);
  }

  const res = await fetch("https://api.elevenlabs.io/v1/single-use-token/tts_websocket", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ allowed_voice_ids: ["*"] }),
  }).catch(() => null);

  if (!res?.ok) {
    const body = await res?.text().catch(() => "");
    throw new HttpException(`ElevenLabs token error: ${body}`, 502);
  }

  const data = (await res.json()) as { token: string };
  return { token: data.token };
}
```

**Step 2: Add `tts.token()` to frontend API client**

In `apps/web/src/lib/api.ts`, add:
```typescript
tts: {
  token: () => request<{ token: string }>("/lessons/tts/token"),
},
```

**Step 3: Add TTS_CONFIG to config.ts**

In `apps/web/src/lib/config.ts`, add:
```typescript
// TTS (ElevenLabs)
export const TTS_CONFIG = {
  MODEL: "eleven_turbo_v2_5",
  OUTPUT_FORMAT: "mp3_22050_32",
  VOICE_SETTINGS: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
} as const;
```

**Step 4: Run type-check**

Run: `pnpm type-check`
Expected: PASS (new code compiles, nothing depends on it yet)

**Step 5: Commit**

```bash
git add apps/api/src/@logic/lesson/presentation/controller/lesson.controller.ts apps/web/src/lib/api.ts apps/web/src/lib/config.ts
git commit -m "feat: add TTS single-use token endpoint and frontend TTS config"
```

---

### Task 2: Send voiceId and speechSpeed to Client

Currently `lesson_started` only sends `{ lessonId }`. The client needs `voiceId` and `speechSpeed` for client-side TTS.

**Files:**
- Modify: `apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts` (lines 81-89)

**Step 1: Include voiceId and speechSpeed in lesson_started**

In `lesson.gateway.ts` `handleConnection()`, change the `lesson_started` emit from:
```typescript
client.emit("lesson_started", {
  lessonId: result.lessonId,
});
```
to:
```typescript
client.emit("lesson_started", {
  lessonId: result.lessonId,
  voiceId: result.voiceId,
  speechSpeed: result.speechSpeed,
});
```

**Step 2: Run type-check**

Run: `pnpm type-check`

**Step 3: Commit**

```bash
git add apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts
git commit -m "feat: send voiceId and speechSpeed in lesson_started event"
```

---

### Task 3: Remove TTS from Server Backend

Remove all TTS usage from the server: `StreamingPipelineService`, `LessonMaintainer`, `LessonGateway`.

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/service/streaming-pipeline.service.ts`
- Modify: `apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts`
- Modify: `apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts`

**Step 1: Refactor StreamingPipelineService — remove TTS**

Replace the entire `streaming-pipeline.service.ts` content. Remove `TtsProvider` import and constructor param. Remove all TTS-related code (synthesizeAndEmit, ttsPromises, ordered emission). Emit text chunks directly.

New `StreamChunk` interface: `{ chunkIndex: number; text: string }` (no `audio`).

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { LlmProvider } from "../../../../@lib/provider/src";
import type { LlmMessage, LlmResponse } from "../../../../@lib/provider/src";
import { ExerciseParserService } from "./exercise-parser.service";
import { SentenceBuffer } from "./sentence-buffer";
import type { Exercise } from "@jake/shared";

export interface StreamChunk {
  chunkIndex: number;
  text: string;
}

export interface StreamResult {
  fullText: string;
  exercise: Exercise | null;
  tokens: LlmResponse;
}

export interface StreamCallbacks {
  onChunk(chunk: StreamChunk): void;
  onEnd(result: StreamResult): void;
  onError(error: Error): void;
}

@Injectable()
export class StreamingPipelineService {
  private readonly logger = new Logger(StreamingPipelineService.name);

  constructor(
    private llm: LlmProvider,
    private exerciseParser: ExerciseParserService,
  ) {}

  async stream(
    systemPrompt: string,
    history: LlmMessage[],
    callbacks: StreamCallbacks,
    options?: { signal?: AbortSignal },
  ): Promise<void> {
    const sentenceBuffer = new SentenceBuffer();
    let chunkIndex = 0;

    try {
      const llmResponse = await this.llm.generateStream(
        systemPrompt,
        history,
        {
          onText: (delta) => {
            const sentences = sentenceBuffer.push(delta);
            for (const sentence of sentences) {
              if (!options?.signal?.aborted) {
                callbacks.onChunk({ chunkIndex: chunkIndex++, text: sentence });
              }
            }
          },
          onDone: () => {
            const remaining = sentenceBuffer.flush();
            if (remaining && !options?.signal?.aborted) {
              callbacks.onChunk({ chunkIndex: chunkIndex++, text: remaining });
            }
          },
        },
        { signal: options?.signal, spanName: "lesson.stream" },
      );

      if (options?.signal?.aborted) return;

      const exercise = this.exerciseParser.extract(llmResponse.text);
      const cleanText = this.exerciseParser.removeExerciseTags(llmResponse.text);

      callbacks.onEnd({
        fullText: cleanText,
        exercise,
        tokens: llmResponse,
      });
    } catch (error) {
      if (options?.signal?.aborted) return;
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
```

**Step 2: Refactor LessonMaintainer — remove TTS**

In `lesson.maintainer.ts`:
- Remove `TtsProvider` import and constructor parameter
- `startLesson()`: remove `greetingAudio`, `tts.synthesize()` call, return `greeting: { text, exercise }` (no `audio`)
- `processExerciseAnswer()`: remove TTS call, return `{ tutorText }` (no `tutorAudio`)
- `processTextMessageStreaming()`: remove `voiceId` param from `this.streamingPipeline.stream()` call, remove `speechSpeed` from options
- `emitSafetyResponse()`: remove TTS call, remove `voiceId`/`speechSpeed` params. Emit text-only.
- `createModerationGate()`: no changes needed (StreamChunk type changed but gate logic is the same)

Key changes in `startLesson()`:
```typescript
async startLesson(userId: string) {
  const context = await this.contextService.build(userId);
  const systemPrompt = buildFullSystemPrompt(context);
  const greeting = await this.responseService.generate(systemPrompt, [
    { role: "user", content: pickGreetingPrompt() },
  ], "lesson.greeting");

  const lesson = await this.lessonRepository.createWithGreeting(
    { userId, tutorId: context.tutorId, lessonNumber: context.lessonNumber },
    greeting.text,
  );

  const speechSpeed = toSpeechSpeed(context.preferences.speakingSpeed);

  return {
    lessonId: lesson.id,
    systemPrompt,
    voiceId: context.tutorVoiceId,
    speechSpeed,
    greeting: { text: greeting.text, exercise: greeting.exercise },
  };
}
```

Key changes in `processExerciseAnswer()`:
```typescript
async processExerciseAnswer(
  lessonId: string,
  userId: string,
  systemPrompt: string,
  history: LlmMessage[],
) {
  const response = await this.responseService.generate(systemPrompt, history);
  await this.messageRepository.create({ lessonId, role: "tutor", content: response.text });
  await this.factQueue.add("extract", {
    userId, lessonId,
    userMessage: history[history.length - 1]?.content ?? "",
    history,
  });
  return { tutorText: response.text };
}
```

Key changes in `processTextMessageStreaming()`:
```typescript
// Remove voiceId from stream call
await this.streamingPipeline.stream(
  session.systemPrompt,
  updatedHistory,
  {
    onChunk: (chunk) => { gate.handleChunk(chunk); },
    onEnd: (result) => { /* same as before */ },
    onError: (error) => { callbacks.onError(error); },
  },
  { signal: options?.signal },
);
```

Key changes in `emitSafetyResponse()`:
```typescript
private emitSafetyResponse(callbacks: StreamCallbacks) {
  callbacks.onChunk({ chunkIndex: 0, text: SAFETY_RESPONSE });
  callbacks.onEnd({ fullText: SAFETY_RESPONSE, exercise: null, tokens: { text: "", inputTokens: 0, outputTokens: 0 } });
}
```

Note: `emitSafetyResponse` no longer needs to be `async` (no TTS call).

**Step 3: Update LessonGateway — remove audio from events**

In `lesson.gateway.ts`:
- `handleConnection()`: change `tutor_message` emit to send only `{ text, exercise }` (no `audio`)
- `handleExerciseAnswer()`: change `exercise_feedback` emit to send only `{ text }` (no `audio`). Also update `processExerciseAnswer()` call (remove `voiceId`, `speechSpeed` params).

```typescript
// In handleConnection():
client.emit("tutor_message", {
  text: result.greeting.text,
  exercise: result.greeting.exercise,
});

// In handleExerciseAnswer():
const result = await this.lessonMaintainer.processExerciseAnswer(
  updatedSession.lessonId,
  userId,
  updatedSession.systemPrompt,
  updatedSession.history,
);
// ...
client.emit("exercise_feedback", {
  text: result.tutorText,
});
```

**Step 4: Run type-check**

Run: `pnpm type-check`
Expected: Backend passes. Frontend will have type errors (audio fields removed), which we fix in later tasks.

**Step 5: Commit**

```bash
git add apps/api/src/@logic/lesson/application/service/streaming-pipeline.service.ts apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts
git commit -m "refactor: remove server-side TTS from streaming pipeline, maintainer, and gateway"
```

---

### Task 4: Delete Server TTS Infrastructure

**Files:**
- Delete: `apps/api/src/@logic/voice/src/elevenlabs-tts.provider.ts`
- Delete: `apps/api/src/@logic/voice/src/voice.module.ts`
- Delete: `apps/api/src/@lib/provider/src/tts-provider.ts`
- Modify: `apps/api/src/@lib/provider/src/index.ts` — remove TtsProvider export
- Modify: `apps/api/src/@logic/lesson/lesson.module.ts` — remove VoiceModule import

**Step 1: Delete files**

Delete:
- `apps/api/src/@logic/voice/src/elevenlabs-tts.provider.ts`
- `apps/api/src/@logic/voice/src/voice.module.ts`
- `apps/api/src/@lib/provider/src/tts-provider.ts`

**Step 2: Remove TtsProvider from provider index**

In `apps/api/src/@lib/provider/src/index.ts`, remove:
```typescript
export { TtsProvider } from "./tts-provider";
```

Result:
```typescript
export { LlmProvider } from "./llm-provider";
export type { LlmMessage, LlmResponse, LlmStreamCallbacks } from "./llm-provider";
export { EmbeddingProvider } from "./embedding-provider";
```

**Step 3: Remove VoiceModule from LessonModule**

In `apps/api/src/@logic/lesson/lesson.module.ts`:
- Remove `import { VoiceModule } from "../voice/src/voice.module";`
- Remove `VoiceModule` from `imports` array

**Step 4: Check for any remaining TTS references**

Search for any remaining `TtsProvider`, `VoiceModule`, `synthesize` imports in the API codebase. There should be none after the previous task.

**Step 5: Check if voice directory is empty and clean up**

After deleting the two files, check if `apps/api/src/@logic/voice/src/` has any remaining files. If `llm-tracing` import in `elevenlabs-tts.provider.ts` was the only consumer, the directory should be empty. Delete the directory if empty.

Actually, check: there's a `voice/` directory structure. After removing the 2 files, there might be an empty `src/` directory. Clean up as needed.

**Step 6: Run type-check**

Run: `pnpm type-check`

**Step 7: Commit**

```bash
git add -A apps/api/src/@logic/voice/ apps/api/src/@lib/provider/src/tts-provider.ts apps/api/src/@lib/provider/src/index.ts apps/api/src/@logic/lesson/lesson.module.ts
git commit -m "refactor: delete VoiceModule, TtsProvider, ElevenLabsTtsProvider"
```

---

### Task 5: Create `useTutorTts` Hook

The core frontend hook that manages ElevenLabs WebSocket connection and audio playback.

**Files:**
- Create: `apps/web/src/hooks/useTutorTts.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useRef, useState, useCallback } from "react";
import { useCallbackRef } from "./useCallbackRef";
import { api } from "@/lib/api";
import { TTS_CONFIG } from "@/lib/config";

interface UseTutorTtsOptions {
  voiceId: string | null;
  speechSpeed?: number;
  onPlayStart?: () => void;
  onAllDone?: () => void;
}

interface UseTutorTtsReturn {
  speak: (text: string) => void;
  startStream: () => void;
  sendChunk: (text: string) => void;
  endStream: () => void;
  stop: () => void;
  isSpeaking: boolean;
}

const log = (...args: unknown[]) => { console.log("[TTS]", ...args); };

export function useTutorTts(options: UseTutorTtsOptions): UseTutorTtsReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const optionsRef = useCallbackRef(options);

  // Pending sentences: when WS is not yet open, buffer text to send once connected
  const pendingTextRef = useRef<string[]>([]);
  const isStreamingRef = useRef(false);
  const wsReadyRef = useRef(false);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const playNext = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      playingRef.current = false;
      setIsSpeaking(false);
      log("all audio done");
      optionsRef.current?.onAllDone?.();
      return;
    }

    const base64 = audioQueueRef.current.shift()!;
    cleanupAudio();

    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => { cleanupAudio(); playNext(); };
      audio.onerror = () => { cleanupAudio(); playNext(); };

      log(`playing chunk (${blob.size} bytes)`);
      audio.play().catch(() => { cleanupAudio(); playNext(); });
    } catch {
      log("decode error");
      playNext();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupAudio]);

  const enqueueAudio = useCallback((base64: string) => {
    audioQueueRef.current.push(base64);
    if (!playingRef.current) {
      playingRef.current = true;
      setIsSpeaking(true);
      optionsRef.current?.onPlayStart?.();
      playNext();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playNext]);

  const closeWs = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    }
    wsReadyRef.current = false;
    pendingTextRef.current = [];
  }, []);

  const sendTextToWs = useCallback((text: string, flush: boolean) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: text + " ", flush }));
      log("sent text:", text.slice(0, 50));
    }
  }, []);

  const sendEos = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: "" }));
      log("sent EOS");
    }
  }, []);

  const openWs = useCallback(async (onReady: () => void) => {
    const voiceId = optionsRef.current?.voiceId;
    if (!voiceId) {
      log("no voiceId, skipping TTS");
      return;
    }

    try {
      const { token } = await api.tts.token();
      const speed = optionsRef.current?.speechSpeed ?? 1.0;

      const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${TTS_CONFIG.MODEL}&output_format=${TTS_CONFIG.OUTPUT_FORMAT}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Accumulate base64 chunks, enqueue when we detect a sentence boundary
      let audioBuffer = "";

      ws.onopen = () => {
        log("WS connected to ElevenLabs");
        // Send init message (BOS)
        ws.send(JSON.stringify({
          text: " ",
          voice_settings: TTS_CONFIG.VOICE_SETTINGS,
          xi_api_key: token,
          generation_config: { chunk_length_schedule: [120] },
          ...(speed !== 1.0 ? { speed } : {}),
        }));
        wsReadyRef.current = true;
        onReady();
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as { audio?: string; isFinal?: boolean };
        if (msg.audio) {
          audioBuffer += msg.audio;
        }
        if (msg.isFinal) {
          // End of stream — enqueue any remaining audio
          if (audioBuffer) {
            enqueueAudio(audioBuffer);
            audioBuffer = "";
          }
          closeWs();
        }
      };

      ws.onerror = () => { log("WS error"); closeWs(); };
      ws.onclose = () => { log("WS closed"); wsRef.current = null; wsReadyRef.current = false; };
    } catch (error) {
      log("failed to open TTS WS:", error);
      closeWs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enqueueAudio, closeWs]);

  /** Speak a single message (greeting, exercise feedback). Opens WS, sends text, closes. */
  const speak = useCallback((text: string) => {
    if (!text.trim()) return;
    log("speak:", text.slice(0, 50));

    void openWs(() => {
      sendTextToWs(text, true);
      sendEos();
    });
  }, [openWs, sendTextToWs, sendEos]);

  /** Start a streaming TTS session. Call sendChunk() for each sentence, then endStream(). */
  const startStream = useCallback(() => {
    log("startStream");
    isStreamingRef.current = true;
    pendingTextRef.current = [];

    void openWs(() => {
      // Send any chunks that arrived before WS was ready
      for (const text of pendingTextRef.current) {
        sendTextToWs(text, true);
      }
      pendingTextRef.current = [];
    });
  }, [openWs, sendTextToWs]);

  /** Send a text chunk (sentence) during a streaming session. */
  const sendChunk = useCallback((text: string) => {
    if (!text.trim()) return;

    if (wsReadyRef.current) {
      sendTextToWs(text, true);
    } else {
      // Buffer until WS is ready
      pendingTextRef.current.push(text);
    }
  }, [sendTextToWs]);

  /** End the streaming session. */
  const endStream = useCallback(() => {
    log("endStream");
    isStreamingRef.current = false;

    if (wsReadyRef.current) {
      sendEos();
    }
    // If WS not ready yet, onReady will send pending + we check isStreamingRef
  }, [sendEos]);

  /** Stop everything — close WS, stop audio. */
  const stop = useCallback(() => {
    log("stop");
    isStreamingRef.current = false;
    closeWs();
    audioQueueRef.current = [];
    cleanupAudio();
    playingRef.current = false;
    setIsSpeaking(false);
  }, [closeWs, cleanupAudio]);

  return { speak, startStream, sendChunk, endStream, stop, isSpeaking };
}
```

**Step 2: Run type-check**

Run: `pnpm type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/hooks/useTutorTts.ts
git commit -m "feat: add useTutorTts hook for client-side ElevenLabs WebSocket TTS"
```

---

### Task 6: Update Frontend Event Handling — Remove Audio Fields

Remove `audio` field from all event data types and action types in `handleLessonEvent.ts`.

**Files:**
- Modify: `apps/web/src/hooks/lesson/handleLessonEvent.ts`

**Step 1: Remove audio from interfaces and actions**

In `handleLessonEvent.ts`:

1. Remove `audio?: string;` from `LessonEventData`
2. Remove `PendingMessage` interface entirely
3. Remove `play_audio` action type
4. Remove `audio` from `stream_chunk` action type
5. Update `tutor_message` handler: always return `show_message` (no audio branch)
6. Update `exercise_feedback` handler: always return `show_message` (no audio branch)
7. Remove `audio` from `tutor_chunk` handler

New `LessonAction` type:
```typescript
export type LessonAction =
  | { type: "set_state"; patch: Record<string, unknown> }
  | { type: "show_message"; text: string; exercise: LessonExercise | null; status: string }
  | { type: "stream_chunk"; chunkIndex: number; text: string; messageId?: string }
  | { type: "stream_end"; fullText: string; exercise: LessonExercise | null; messageId?: string }
  | { type: "discard" };
```

Updated event handlers:
```typescript
case "tutor_message": {
  const shouldDiscard = ctx.userSpeaking || ctx.pendingTurns > 1;
  if (shouldDiscard) return { type: "discard" };
  return {
    type: "show_message",
    text: data.text ?? "",
    exercise: mapExercise(data.exercise),
    status: "idle",
  };
}

case "exercise_feedback": {
  const shouldDiscardFb = ctx.userSpeaking || ctx.pendingTurns > 1;
  if (shouldDiscardFb) return { type: "discard" };
  return {
    type: "show_message",
    text: data.text ?? "",
    exercise: null,
    status: "idle",
  };
}

case "tutor_chunk": {
  if (ctx.userSpeaking) return { type: "discard" };
  return {
    type: "stream_chunk",
    chunkIndex: data.chunkIndex ?? 0,
    text: data.text ?? "",
    messageId: data.messageId,
  };
}
```

**Step 2: Run type-check**

Run: `pnpm type-check`
Expected: Errors in `useLessonState.ts` (references `play_audio`, `audio` on stream_chunk). These will be fixed in Task 7.

**Step 3: Commit**

```bash
git add apps/web/src/hooks/lesson/handleLessonEvent.ts
git commit -m "refactor: remove audio fields from lesson event handling"
```

---

### Task 7: Refactor `useLessonState` — Integrate Client-Side TTS

This is the main frontend integration task. Replace server audio handling with `useTutorTts`.

**Files:**
- Modify: `apps/web/src/hooks/useLessonState.ts`

**Step 1: Rewrite useLessonState**

Key changes:
- Remove `useAudioQueue` import and usage
- Remove `pendingAudioRef`, `streamChunksRef`, `streamEndRef`, `audioDoneRef` refs for text-audio sync
- Add `voiceIdRef` and `speechSpeedRef` (set from `lesson_started`)
- Add `useTutorTts` hook
- **Text displays immediately** — no buffered reveal
- For `tutor_message` (`show_message` action): call `tts.speak(text)` to synthesize audio
- For `tutor_chunk` (`stream_chunk` action): on first chunk, call `tts.startStream()`. For each chunk, call `tts.sendChunk(text)` and show text immediately.
- For `tutor_stream_end` (`stream_end` action): call `tts.endStream()`, apply final text.
- For `exercise_feedback` (`show_message` action): call `tts.speak(text)`
- `interruptTutor`: call `tts.stop()`
- `playPending`: remove entirely (no buffered greeting audio)
- `hasPending`: remove
- `isPlaying`: from `tts.isSpeaking`

```typescript
import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { useTutorTts } from "./useTutorTts";
import { handleLessonEvent, type LessonEventData } from "./lesson/handleLessonEvent";
import { WS_URL } from "@/lib/config";
import type { ChatMessage, LessonExercise, LessonStatus } from "@/types";

interface LessonState {
  lessonId: string | null;
  messages: ChatMessage[];
  currentExercise: LessonExercise | null;
  status: LessonStatus;
  lessonEnded: boolean;
  error: string | null;
}

export function useLessonState(token?: string | null) {
  const [state, setState] = useState<LessonState>({
    lessonId: null,
    messages: [],
    currentExercise: null,
    status: "connecting",
    lessonEnded: false,
    error: null,
  });

  const userSpeakingRef = useRef(false);
  const pendingTurnsRef = useRef(0);
  const activeMessageIdRef = useRef<string | null>(null);
  const voiceIdRef = useRef<string | null>(null);
  const speechSpeedRef = useRef<number>(1.0);
  const streamStartedRef = useRef(false);

  const tts = useTutorTts({
    voiceId: voiceIdRef.current,
    speechSpeed: speechSpeedRef.current,
  });
  const ttsRef = useRef(tts);
  ttsRef.current = tts;

  const handleEvent = useCallback((event: string, data: LessonEventData) => {
    console.log("[Lesson] event:", event, data.text ? `"${data.text.slice(0, 50)}..."` : "");

    // Capture voiceId and speechSpeed from lesson_started
    if (event === "lesson_started") {
      const d = data as LessonEventData & { voiceId?: string; speechSpeed?: number };
      if (d.voiceId) voiceIdRef.current = d.voiceId;
      if (d.speechSpeed) speechSpeedRef.current = d.speechSpeed;
    }

    const action = handleLessonEvent(event, data, {
      userSpeaking: userSpeakingRef.current,
      pendingTurns: pendingTurnsRef.current,
    });

    if (event === "tutor_message" || event === "exercise_feedback") {
      pendingTurnsRef.current = Math.max(0, pendingTurnsRef.current - 1);
    }

    switch (action.type) {
      case "set_state":
        setState((prev) => {
          const patch = action.patch;
          if (event === "status" && patch["status"] === undefined) return prev;
          return { ...prev, ...patch } as LessonState;
        });
        if (event === "error") console.error("Lesson error:", data.message);
        break;

      case "show_message":
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              text: action.text,
              timestamp: Date.now(),
              exercise: action.exercise,
            },
          ],
          currentExercise: action.exercise,
          status: "idle",
        }));
        // Speak the message via client-side TTS
        if (action.text) {
          ttsRef.current.speak(action.text);
        }
        break;

      case "stream_chunk": {
        if (action.messageId && activeMessageIdRef.current && action.messageId !== activeMessageIdRef.current) {
          console.log("[Lesson] discarding stale chunk, messageId mismatch");
          break;
        }
        if (action.messageId && !activeMessageIdRef.current) {
          console.log("[Lesson] discarding chunk, no active generation");
          break;
        }

        // Start TTS stream on first chunk
        if (!streamStartedRef.current) {
          streamStartedRef.current = true;
          ttsRef.current.startStream();
        }

        // Send text to TTS
        ttsRef.current.sendChunk(action.text);

        // Show text immediately
        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant" && prev.status === "speaking") {
            messages[messages.length - 1] = {
              ...last,
              text: last.text ? last.text + " " + action.text : action.text,
            };
          } else {
            messages.push({
              role: "assistant",
              text: action.text,
              timestamp: Date.now(),
            });
          }
          return { ...prev, messages, status: "speaking" };
        });
        break;
      }

      case "stream_end": {
        if (action.messageId && activeMessageIdRef.current && action.messageId !== activeMessageIdRef.current) {
          console.log("[Lesson] discarding stale stream_end, messageId mismatch");
          break;
        }
        if (action.messageId && !activeMessageIdRef.current) {
          console.log("[Lesson] discarding stream_end, no active generation");
          break;
        }

        activeMessageIdRef.current = null;
        streamStartedRef.current = false;

        // End TTS stream
        ttsRef.current.endStream();

        // Apply final text
        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant") {
            messages[messages.length - 1] = {
              ...last,
              text: action.fullText,
              exercise: action.exercise,
            };
          } else {
            messages.push({
              role: "assistant",
              text: action.fullText,
              timestamp: Date.now(),
              exercise: action.exercise,
            });
          }
          return { ...prev, messages, currentExercise: action.exercise, status: "idle" };
        });
        break;
      }

      case "discard":
        if (event === "tutor_message" || event === "exercise_feedback" || event === "tutor_chunk") {
          console.log("[Lesson] discarding", event);
        }
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { emit, connected } = useWebSocket({
    url: WS_URL,
    token: token ?? null,
    onEvent: handleEvent,
  });

  const sendText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      pendingTurnsRef.current++;
      const trimmed = text.trim();
      const messageId = crypto.randomUUID();
      activeMessageIdRef.current = messageId;
      setState((prev) => {
        const last = prev.messages[prev.messages.length - 1];
        if (last?.role === "user") {
          const updated = [...prev.messages];
          updated[updated.length - 1] = { ...last, text: last.text + " " + trimmed };
          return { ...prev, messages: updated, status: "thinking" };
        }
        return {
          ...prev,
          messages: [...prev.messages, { role: "user", text: trimmed, timestamp: Date.now() }],
          status: "thinking",
        };
      });
      emit("text", { text: trimmed, messageId });
    },
    [emit],
  );

  const submitExerciseAnswer = useCallback(
    (exerciseId: string, answer: string) => {
      emit("exercise_answer", { exerciseId, answer });
    },
    [emit],
  );

  const endLesson = useCallback(() => {
    emit("end_lesson", {});
  }, [emit]);

  const interruptTutor = useCallback(() => {
    tts.stop();
    emit("interrupt", {});
    activeMessageIdRef.current = null;
    streamStartedRef.current = false;

    setState((prev) => {
      const messages = [...prev.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.text && prev.status === "speaking") {
        messages[messages.length - 1] = { ...last, text: last.text + "..." };
      }
      return {
        ...prev,
        messages,
        status: prev.status === "speaking" ? "idle" : prev.status,
      };
    });
  }, [tts, emit]);

  const setUserSpeaking = useCallback((speaking: boolean) => {
    userSpeakingRef.current = speaking;
  }, []);

  return {
    ...state,
    connected,
    isPlaying: tts.isSpeaking,
    sendText,
    submitExerciseAnswer,
    endLesson,
    interruptTutor,
    stopAllAudio: useCallback(() => { tts.stop(); }, [tts]),
    setUserSpeaking,
  };
}
```

**Step 2: Update LessonScreen — remove playPending and hasPending**

In `apps/web/src/components/lesson/LessonScreen.tsx`:
- Remove `playPending` from `useLessonState` destructuring
- Remove the `useEffect` that calls `playPending()` after mic is ready (lines 73-80)
- Keep everything else the same

```typescript
// Remove playPending from destructuring:
const {
  messages, currentExercise, status, connected, isPlaying,
  lessonEnded: serverLessonEnded, error: lessonError, sendText,
  submitExerciseAnswer, endLesson, interruptTutor, stopAllAudio,
  setUserSpeaking,
} = useLessonState(token);

// Delete the useEffect that calls playPending (lines 73-80)
```

**Step 3: Run type-check**

Run: `pnpm type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/hooks/useLessonState.ts apps/web/src/components/lesson/LessonScreen.tsx
git commit -m "refactor: integrate useTutorTts into useLessonState, remove server audio handling"
```

---

### Task 8: Update CSP and Clean Up

**Files:**
- Modify: `apps/web/next.config.js` — add ElevenLabs to CSP connect-src
- Delete: `apps/web/src/hooks/useAudioQueue.ts` (no longer used)

**Step 1: Update CSP**

In `apps/web/next.config.js`, update the `connect-src` directive to include ElevenLabs:

Change:
```javascript
`connect-src 'self' wss://api.deepgram.com https://api.deepgram.com${isDev ? " ws://localhost:4000 http://localhost:4000" : ""}`,
```
to:
```javascript
`connect-src 'self' wss://api.deepgram.com https://api.deepgram.com wss://api.elevenlabs.io https://api.elevenlabs.io${isDev ? " ws://localhost:4000 http://localhost:4000" : ""}`,
```

**Step 2: Check if useAudioQueue is still imported anywhere**

Search for `useAudioQueue` imports. If only used by the old `useLessonState`, delete it.

**Step 3: Delete useAudioQueue if unused**

Delete `apps/web/src/hooks/useAudioQueue.ts`.

**Step 4: Remove `unlockAudio` export if the function is only used by deleted code**

Check if `unlockAudio` from `useAudioPlayer` is still used. It's imported in `useStudentStt.ts` — keep it.

**Step 5: Run type-check**

Run: `pnpm type-check`

**Step 6: Run lint**

Run: `pnpm lint`

**Step 7: Commit**

```bash
git add apps/web/next.config.js
git rm apps/web/src/hooks/useAudioQueue.ts
git commit -m "feat: add ElevenLabs to CSP, remove unused useAudioQueue"
```

---

### Task 9: Remove `elevenlabs` Package from API (if installed)

**Step 1: Check if elevenlabs package exists in API**

Check `apps/api/package.json` for any ElevenLabs SDK dependency. The current implementation uses raw `fetch()`, so there likely isn't one. If found, remove it.

Run: `grep -i elevenlabs apps/api/package.json`

**Step 2: If found, remove it**

```bash
cd apps/api && pnpm remove elevenlabs
```

**Step 3: Verify and commit if changes were made**

---

### Task 10: Final Verification

**Step 1: Run full type-check**

Run: `pnpm type-check`

**Step 2: Run lint**

Run: `pnpm lint`

**Step 3: Run API tests**

Run: `pnpm --filter @jake/api test`

**Step 4: Verify no remaining TTS references on server**

Search for `TtsProvider`, `synthesize`, `ElevenLabs` in `apps/api/src/`. Should find zero results (except maybe comments).

**Step 5: Verify no remaining audio fields in events**

Search for `audio:` in `apps/web/src/hooks/useLessonState.ts` and `handleLessonEvent.ts`. Should find zero results.

**Step 6: Commit any fixes**

If any issues found, fix and commit.
