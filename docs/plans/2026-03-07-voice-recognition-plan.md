# Voice Recognition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect voice changes between lessons so Jake can naturally ask "are you feeling okay?" when a student sounds different.

**Architecture:** Client buffers first 10 seconds of audio and sends it via WebSocket `voice_sample` event. Server extracts speaker embedding using Transformers.js (ONNX model). First 3 lessons build a voiceprint. After that, compare and add a hint to Claude's system prompt if voice differs.

**Tech Stack:** @huggingface/transformers (ONNX speaker embedding), pgvector, Drizzle ORM, Socket.IO

---

### Task 1: Install @huggingface/transformers in API

**Files:**
- Modify: `apps/api/package.json`

**Step 1: Install dependency**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/api add @huggingface/transformers`

**Step 2: Verify installation**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/api exec node -e "require('@huggingface/transformers'); console.log('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "feat(voice): add @huggingface/transformers for speaker embedding"
```

---

### Task 2: Create `voice_prints` table and migration

**Files:**
- Create: `apps/api/src/@logic/lesson/infrastructure/table/voice-print.table.ts`
- Create: `apps/api/drizzle/NNNN_add_voice_prints.sql` (manual migration)

**Step 1: Create table definition**

Reference pattern from `apps/api/src/@logic/memory/infrastructure/table/memory-embedding.table.ts`.

Create `apps/api/src/@logic/lesson/infrastructure/table/voice-print.table.ts`:

```typescript
import { pgTable, uuid, integer, timestamp, index, customType } from "drizzle-orm/pg-core";
import { userTable } from "../../../auth/infrastructure/table/user.table";

const vector = customType<{ data: number[]; driverType: string }>({
  dataType() {
    return "vector(256)";
  },
  toDriver(value: number[]) {
    return `[${value.join(",")}]`;
  },
});

export const voicePrintTable = pgTable(
  "voice_prints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull(),
    embedding: vector("embedding"),
    sampleCount: integer("sample_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("voice_prints_user_idx").on(table.userId),
  }),
);
```

Note: Vector dimension (256) is for `wespeaker-voxceleb-resnet34`. Verify actual model output dimension during Task 4 and adjust if needed.

**Step 2: Create SQL migration**

Create `apps/api/drizzle/NNNN_add_voice_prints.sql` (use next sequential number):

```sql
CREATE TABLE IF NOT EXISTS "voice_prints" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "embedding" vector(256),
  "sample_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "voice_prints_user_idx" ON "voice_prints" ("user_id");
```

**Step 3: Apply migration locally**

Run: `pnpm db:migrate`

**Step 4: Commit**

```bash
git add apps/api/src/@logic/lesson/infrastructure/table/voice-print.table.ts apps/api/drizzle/
git commit -m "feat(voice): add voice_prints table for speaker verification"
```

---

### Task 3: Create VoicePrintRepository

**Files:**
- Create: `apps/api/src/@logic/lesson/infrastructure/repository/voice-print.repository.ts`

**Step 1: Create repository**

Reference pattern from `apps/api/src/@logic/memory/infrastructure/repository/memory-embedding.repository.ts`.

```typescript
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DRIZZLE_PG } from "@shared/shared-drizzle-pg/drizzle-pg.token";
import { voicePrintTable } from "../table/voice-print.table";

@Injectable()
export class VoicePrintRepository {
  constructor(@Inject(DRIZZLE_PG) private db: NodePgDatabase) {}

  async findByUser(userId: string) {
    const rows = await this.db
      .select()
      .from(voicePrintTable)
      .where(eq(voicePrintTable.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsert(userId: string, embedding: number[], sampleCount: number) {
    const existing = await this.findByUser(userId);
    if (existing) {
      await this.db
        .update(voicePrintTable)
        .set({ embedding, sampleCount, updatedAt: new Date() })
        .where(eq(voicePrintTable.userId, userId));
    } else {
      await this.db.insert(voicePrintTable).values({
        userId,
        embedding,
        sampleCount,
      });
    }
  }
}
```

**Step 2: Commit**

```bash
git add apps/api/src/@logic/lesson/infrastructure/repository/voice-print.repository.ts
git commit -m "feat(voice): add VoicePrintRepository"
```

---

### Task 4: Create VoicePrintService

**Files:**
- Create: `apps/api/src/@logic/lesson/application/service/voice-print.service.ts`

This is the core service. It:
1. Extracts speaker embedding from audio using Transformers.js
2. On first 3 lessons: stores and averages embeddings
3. After that: compares with stored voiceprint via cosine similarity

**Step 1: Create service**

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { VoicePrintRepository } from "../../infrastructure/repository/voice-print.repository";

const ENROLLMENT_SAMPLES = 3;
const SIMILARITY_THRESHOLD = 0.75;

export interface VoiceComparisonResult {
  status: "enrolling" | "match" | "mismatch";
  similarity?: number;
  samplesCollected?: number;
}

@Injectable()
export class VoicePrintService {
  private readonly logger = new Logger(VoicePrintService.name);
  private extractor: FeatureExtractionPipeline | null = null;
  private loading: Promise<FeatureExtractionPipeline> | null = null;

  constructor(private voicePrintRepository: VoicePrintRepository) {}

  private async getExtractor(): Promise<FeatureExtractionPipeline> {
    if (this.extractor) return this.extractor;
    if (this.loading) return this.loading;

    this.loading = pipeline("feature-extraction", "Xenova/wespeaker-voxceleb-resnet34-LM", {
      dtype: "fp32",
    }).then((ext) => {
      this.extractor = ext as FeatureExtractionPipeline;
      this.loading = null;
      this.logger.log("Speaker embedding model loaded");
      return this.extractor;
    });

    return this.loading;
  }

  async processVoiceSample(userId: string, audioBuffer: Buffer): Promise<VoiceComparisonResult> {
    const pcm = await this.decodeAudio(audioBuffer);
    const embedding = await this.extractEmbedding(pcm);
    if (!embedding) {
      this.logger.warn("Failed to extract embedding for user " + userId);
      return { status: "match" };
    }

    const stored = await this.voicePrintRepository.findByUser(userId);

    if (!stored || stored.sampleCount < ENROLLMENT_SAMPLES) {
      return this.enroll(userId, embedding, stored);
    }

    return this.compare(embedding, stored.embedding as number[]);
  }

  private async decodeAudio(buffer: Buffer): Promise<Float32Array> {
    // Use @huggingface/transformers read_audio if available,
    // otherwise fall back to ffmpeg via execFile (not exec, to avoid injection)
    const { read_audio } = await import("@huggingface/transformers");
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { randomUUID } = await import("node:crypto");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const tmpPath = join(tmpdir(), `voice-sample-${randomUUID()}.webm`);
    try {
      writeFileSync(tmpPath, buffer);
      return await read_audio(tmpPath, 16000);
    } finally {
      try { unlinkSync(tmpPath); } catch { /* ignore cleanup errors */ }
    }
  }

  private async extractEmbedding(audioBuffer: Float32Array): Promise<number[] | null> {
    try {
      const extractor = await this.getExtractor();
      const output = await extractor(audioBuffer, { pooling: "mean", normalize: true });
      return Array.from(output.data as Float32Array);
    } catch (error) {
      this.logger.error(`Embedding extraction failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async enroll(
    userId: string,
    newEmbedding: number[],
    stored: { embedding: number[] | null; sampleCount: number } | null,
  ): Promise<VoiceComparisonResult> {
    const count = (stored?.sampleCount ?? 0) + 1;
    let averaged: number[];

    if (stored?.embedding) {
      // Running average: new_avg = old_avg + (new - old_avg) / count
      averaged = stored.embedding.map((v, i) => v + ((newEmbedding[i]! - v) / count));
    } else {
      averaged = newEmbedding;
    }

    await this.voicePrintRepository.upsert(userId, averaged, count);
    this.logger.log(`Voice enrollment ${count}/${ENROLLMENT_SAMPLES} for user ${userId}`);

    return { status: "enrolling", samplesCollected: count };
  }

  private compare(embedding: number[], storedEmbedding: number[]): VoiceComparisonResult {
    const similarity = this.cosineSimilarity(embedding, storedEmbedding);
    this.logger.debug(`Voice similarity: ${similarity.toFixed(3)}`);

    return {
      status: similarity >= SIMILARITY_THRESHOLD ? "match" : "mismatch",
      similarity,
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
```

**Important notes:**
- The model `Xenova/wespeaker-voxceleb-resnet34-LM` is loaded lazily on first use
- The model expects raw audio as Float32Array (PCM samples, 16kHz)
- `decodeAudio` uses `read_audio` from transformers.js to convert webm to raw PCM
- If `read_audio` doesn't support webm, fall back to ffmpeg via `execFile` (NOT `exec`)

**Step 2: Test model loading manually**

Write a quick script to verify the model works and check output dimension:

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/api exec node -e "
const { pipeline } = require('@huggingface/transformers');
(async () => {
  const ext = await pipeline('feature-extraction', 'Xenova/wespeaker-voxceleb-resnet34-LM');
  const dummy = new Float32Array(16000 * 10); // 10s silence at 16kHz
  const out = await ext(dummy, { pooling: 'mean', normalize: true });
  console.log('Output shape:', out.dims);
  console.log('Embedding dim:', out.data.length);
})();
"`

If dimension differs from 256, update the `vector(256)` in table definition and migration.

**Step 3: Commit**

```bash
git add apps/api/src/@logic/lesson/application/service/voice-print.service.ts
git commit -m "feat(voice): add VoicePrintService with speaker embedding extraction"
```

---

### Task 5: Add `voice_sample` handler to LessonGateway

**Files:**
- Modify: `apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts`
- Modify: `apps/api/src/@logic/lesson/application/service/lesson-session.service.ts`

**Step 1: Add `voiceMismatch` flag to session**

In `apps/api/src/@logic/lesson/application/service/lesson-session.service.ts`, add to the session interface:

```typescript
interface LessonSession {
  lessonId: string;
  systemPrompt: string;
  voiceId: string;
  speechSpeed: number;
  history: LlmMessage[];
  voiceMismatch?: boolean;  // <-- add this
}
```

Add method to update mismatch flag:

```typescript
async setVoiceMismatch(socketId: string, mismatch: boolean) {
  const session = await this.get(socketId);
  if (!session) return;
  session.voiceMismatch = mismatch;
  await this.save(socketId, session);
}
```

**Step 2: Add handler to gateway**

In `apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts`:

Add `VoicePrintService` to constructor. Add handler:

```typescript
@SubscribeMessage("voice_sample")
async handleVoiceSample(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { audio: string },
) {
  if (!data?.audio) return;

  const userId = (client.data as SocketData).userId;

  try {
    const audioBuffer = Buffer.from(data.audio, "base64");
    const result = await this.voicePrintService.processVoiceSample(userId, audioBuffer);

    if (result.status === "mismatch") {
      await this.sessionService.setVoiceMismatch(client.id, true);
      this.logger.log(`Voice mismatch detected for user ${userId}, similarity: ${result.similarity?.toFixed(3)}`);
    }
  } catch (error) {
    this.logger.error(`Voice sample processing failed: ${error instanceof Error ? error.message : String(error)}`);
    // Non-critical — don't emit error to client, lesson continues normally
  }
}
```

**Step 3: Register VoicePrintService and VoicePrintRepository in LessonModule**

In `apps/api/src/@logic/lesson/lesson.module.ts`, add to providers:

```typescript
import { VoicePrintService } from "./application/service/voice-print.service";
import { VoicePrintRepository } from "./infrastructure/repository/voice-print.repository";

// In providers array:
VoicePrintService,
VoicePrintRepository,
```

**Step 4: Commit**

```bash
git add apps/api/src/@logic/lesson/
git commit -m "feat(voice): add voice_sample WebSocket handler and session flag"
```

---

### Task 6: Add voice mismatch hint to system prompt

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/service/prompt-builder.ts`
- Modify: `apps/api/src/@logic/lesson/application/dto/lesson-context.ts`
- Modify: `apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts`

**Step 1: Add `voiceMismatch` to LessonContext**

In `apps/api/src/@logic/lesson/application/dto/lesson-context.ts`, add:

```typescript
export interface LessonContext {
  // ... existing fields ...
  voiceMismatch?: boolean;  // <-- add this
}
```

**Step 2: Add hint to prompt builder**

In `apps/api/src/@logic/lesson/application/service/prompt-builder.ts`, inside `buildFullSystemPrompt()`, after the EMOTIONAL CONTEXT section (around line 91):

```typescript
if (context.voiceMismatch) {
  parts.push(`\n=== VOICE OBSERVATION ===
The student's voice sounds noticeably different from their usual voice today. They might be sick, tired, or feeling off. You can gently and naturally ask if they're feeling okay — don't make a big deal of it, just show you noticed. One brief mention is enough.`);
}
```

**Step 3: Inject voiceMismatch from session into system prompt**

In `apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts`, inside `processTextMessageStreaming` (after line 133-134):

```typescript
// Inject voice mismatch hint into system prompt (one-time)
let systemPrompt = session.systemPrompt;
if (session.voiceMismatch) {
  systemPrompt += "\n\n=== VOICE OBSERVATION ===\nThe student's voice sounds noticeably different from their usual voice today. They might be sick, tired, or feeling off. You can gently and naturally ask if they're feeling okay — don't make a big deal of it, just show you noticed. One brief mention is enough.";
  // Clear the flag so it's only mentioned once
  await this.sessionService.setVoiceMismatch(socketId, false);
}
```

Use `systemPrompt` variable instead of `session.systemPrompt` in the streaming pipeline call.

**Step 4: Commit**

```bash
git add apps/api/src/@logic/lesson/
git commit -m "feat(voice): add voice mismatch hint to Claude system prompt"
```

---

### Task 7: Client-side — buffer and send 10s audio sample

**Files:**
- Modify: `apps/web/src/hooks/useStudentStt.ts`

**Step 1: Add voice sample buffering refs**

```typescript
const voiceSampleChunksRef = useRef<Blob[]>([]);
const voiceSampleSentRef = useRef(false);
const voiceSampleStartRef = useRef(0);
```

**Step 2: Add `onVoiceSample` callback option**

Add to `UseStudentSttOptions`:

```typescript
onVoiceSample?: (base64Audio: string) => void;
```

Add ref:
```typescript
const onVoiceSampleRef = useCallbackRef(options?.onVoiceSample);
```

**Step 3: Collect chunks in `ondataavailable`**

Modify the handler at line 152-156:

```typescript
recorder.ondataavailable = (e) => {
  if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
    ws.send(e.data);
  }

  // Buffer first 10 seconds for voice sample
  if (!voiceSampleSentRef.current && e.data.size > 0) {
    if (voiceSampleChunksRef.current.length === 0) {
      voiceSampleStartRef.current = Date.now();
    }
    voiceSampleChunksRef.current.push(e.data);

    const elapsed = Date.now() - voiceSampleStartRef.current;
    if (elapsed >= 10_000) {
      voiceSampleSentRef.current = true;
      const blob = new Blob(voiceSampleChunksRef.current, { type: recorder.mimeType });
      voiceSampleChunksRef.current = [];

      blob.arrayBuffer().then((buf) => {
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        onVoiceSampleRef.current?.(base64);
      });
    }
  }
};
```

**Step 4: Reset refs on cleanup**

In the `cleanup` callback, add:

```typescript
voiceSampleChunksRef.current = [];
voiceSampleSentRef.current = false;
```

**Step 5: Commit**

```bash
git add apps/web/src/hooks/useStudentStt.ts
git commit -m "feat(voice): buffer and emit 10s audio sample from STT hook"
```

---

### Task 8: Wire voice sample emission into lesson

**Files:**
- Modify: `apps/web/src/components/lesson/LessonScreen.tsx` (or wherever `useStudentStt` is called with `emit`)

**Step 1: Pass `onVoiceSample` callback**

Find where `useStudentStt` is called and add:

```typescript
onVoiceSample: (base64Audio) => {
  emit("voice_sample", { audio: base64Audio });
},
```

**Step 2: Commit**

```bash
git add apps/web/src/components/lesson/LessonScreen.tsx
git commit -m "feat(voice): send voice sample to server via WebSocket"
```

---

### Task 9: End-to-end testing

**Files:** None (manual testing)

**Step 1: Start local dev**

Run: `docker compose up -d && pnpm dev`

**Step 2: Open lesson and speak for 10+ seconds**

Check server logs for:
- "Speaker embedding model loaded" (first time only)
- "Voice enrollment 1/3 for user ..."

**Step 3: Do 3 lessons to complete enrollment**

After 3 lessons, check DB:
```sql
SELECT user_id, sample_count FROM voice_prints;
```

**Step 4: Test voice mismatch**

After enrollment, test with different voice. Check logs for:
- "Voice mismatch detected for user ..., similarity: 0.XXX"
- Jake mentions voice change in response

**Step 5: Verify no regression**

- Normal lesson flow still works
- STT still streams to Deepgram
- No noticeable latency on lesson start

---

## Risks and Notes

1. **Model dimension**: `wespeaker-voxceleb-resnet34-LM` may output a dimension other than 256. Verify in Task 4 Step 2 and update migration if needed.

2. **Audio format**: Client records in webm/opus. `read_audio` from transformers.js may not support this. If it fails, fall back to ffmpeg via `execFile` (safe, no shell injection) and add ffmpeg to the Dockerfile.

3. **Model download**: First run downloads ~25MB model. In production, consider pre-downloading during Docker build or caching in a volume.

4. **Memory**: ONNX model stays loaded (~50-100MB). Should be fine on 4GB VPS but monitor.

5. **Base64 size**: 10s opus audio ~160KB, base64 ~210KB. Well within 10MB WebSocket limit.

6. **Non-blocking**: Voice processing runs async. Lesson continues normally while voice is analyzed.
