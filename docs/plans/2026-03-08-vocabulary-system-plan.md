# Vocabulary System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an interactive vocabulary system — words highlighted in real-time during lessons, tracked with 5-review spaced repetition, viewable on dashboard and dedicated `/vocabulary` page.

**Architecture:** Modify the existing `vocabulary` table (add translation, topic, status, review_count fields, remove strength/next_review). Parse new `<vocab>` and `<vocab_reviewed>` tags in StreamingPipeline. Add vocabulary REST endpoints. Build dashboard widget + `/vocabulary` page on the frontend.

**Tech Stack:** Drizzle ORM (migration), NestJS (controller/contract/repository), Next.js (pages), Tailwind CSS (UI), Socket.IO (real-time events), Zod (schemas)

---

### Task 1: DB Migration — Update vocabulary table

**Files:**
- Modify: `apps/api/src/@logic/vocabulary/infrastructure/table/vocabulary.table.ts`

**Step 1: Update Drizzle table definition**

Replace `vocabulary.table.ts` with:

```typescript
import { pgTable, uuid, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
import { userTable } from "../../../auth/infrastructure/table/user.table";
import { lessonTable } from "../../../lesson/infrastructure/table/lesson.table";

export const vocabularyTable = pgTable(
  "vocabulary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => userTable.id, { onDelete: "cascade" }).notNull(),
    word: varchar("word", { length: 255 }).notNull(),
    translation: varchar("translation", { length: 255 }),
    topic: varchar("topic", { length: 100 }),
    lessonId: uuid("lesson_id").references(() => lessonTable.id),
    status: varchar("status", { length: 20 }).default("new").notNull(),
    reviewCount: integer("review_count").default(0).notNull(),
    lastReviewedAt: timestamp("last_reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("vocabulary_user_idx").on(table.userId),
    statusIdx: index("vocabulary_status_idx").on(table.userId, table.status),
  }),
);
```

**Step 2: Generate migration**

Run: `pnpm --filter @jake/api db:generate`
Expected: New SQL file in `apps/api/drizzle/` with ALTER TABLE statements

**Step 3: Apply migration locally**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 4: Commit**

```bash
git add apps/api/src/@logic/vocabulary/infrastructure/table/vocabulary.table.ts apps/api/drizzle/
git commit -m "feat(vocabulary): update table schema — add translation, topic, status, review_count"
```

---

### Task 2: Update Vocabulary Repository & Contract

**Files:**
- Modify: `apps/api/src/@logic/vocabulary/infrastructure/repository/vocabulary.repository.ts`
- Modify: `apps/api/src/@logic/vocabulary/contract/vocabulary.contract.ts`

**Step 1: Update repository**

Replace `vocabulary.repository.ts`:

```typescript
import { Injectable } from "@nestjs/common";
import { AppDrizzleTransactionHost } from "@shared/shared-drizzle-pg/app-drizzle-transaction-host";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { vocabularyTable } from "../table/vocabulary.table";
import { VocabularyEntity } from "../../domain/entity/vocabulary.entity";
import { VocabularyFactory } from "../factory/vocabulary.factory";

@Injectable()
export class VocabularyRepository {
  constructor(private readonly txHost: AppDrizzleTransactionHost<{ vocabulary: typeof vocabularyTable }>) {}

  async upsert(data: {
    userId: string;
    word: string;
    translation?: string;
    topic?: string;
    lessonId?: string;
  }): Promise<VocabularyEntity> {
    const existing = await this.txHost.tx
      .select()
      .from(vocabularyTable)
      .where(and(eq(vocabularyTable.userId, data.userId), eq(vocabularyTable.word, data.word)))
      .limit(1);

    const existingRow = existing[0];
    if (existingRow) {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (data.translation && !existingRow.translation) updates["translation"] = data.translation;
      if (data.topic && !existingRow.topic) updates["topic"] = data.topic;
      if (data.lessonId && !existingRow.lessonId) updates["lessonId"] = data.lessonId;

      await this.txHost.tx.update(vocabularyTable).set(updates).where(eq(vocabularyTable.id, existingRow.id));
      return VocabularyFactory.create({ ...existingRow, ...updates } as typeof existingRow);
    }

    const [row] = await this.txHost.tx
      .insert(vocabularyTable)
      .values({
        userId: data.userId,
        word: data.word,
        translation: data.translation,
        topic: data.topic,
        lessonId: data.lessonId,
        status: "new",
        reviewCount: 0,
      })
      .returning();
    if (!row) throw new Error("INSERT into vocabulary did not return a row");
    return VocabularyFactory.create(row);
  }

  async incrementReview(userId: string, words: string[]): Promise<void> {
    if (words.length === 0) return;

    await this.txHost.tx
      .update(vocabularyTable)
      .set({
        reviewCount: sql`${vocabularyTable.reviewCount} + 1`,
        lastReviewedAt: new Date(),
        updatedAt: new Date(),
        status: sql`CASE WHEN ${vocabularyTable.reviewCount} + 1 >= 5 THEN 'learned' ELSE 'learning' END`,
      })
      .where(and(eq(vocabularyTable.userId, userId), inArray(vocabularyTable.word, words)));
  }

  async findByUser(
    userId: string,
    filters?: { status?: string; topic?: string; lessonId?: string },
    offset = 0,
    limit = 50,
  ): Promise<VocabularyEntity[]> {
    const conditions = [eq(vocabularyTable.userId, userId)];
    if (filters?.status) conditions.push(eq(vocabularyTable.status, filters.status));
    if (filters?.topic) conditions.push(eq(vocabularyTable.topic, filters.topic));
    if (filters?.lessonId) conditions.push(eq(vocabularyTable.lessonId, filters.lessonId));

    const rows = await this.txHost.tx
      .select()
      .from(vocabularyTable)
      .where(and(...conditions))
      .orderBy(desc(vocabularyTable.createdAt))
      .offset(offset)
      .limit(limit);
    return VocabularyFactory.createMany(rows);
  }

  async findRecentByUser(userId: string, limit = 20): Promise<VocabularyEntity[]> {
    const rows = await this.txHost.tx
      .select()
      .from(vocabularyTable)
      .where(eq(vocabularyTable.userId, userId))
      .orderBy(desc(vocabularyTable.createdAt))
      .limit(limit);
    return VocabularyFactory.createMany(rows);
  }

  async findNotLearned(userId: string, limit = 30): Promise<VocabularyEntity[]> {
    const rows = await this.txHost.tx
      .select()
      .from(vocabularyTable)
      .where(and(
        eq(vocabularyTable.userId, userId),
        sql`${vocabularyTable.status} != 'learned'`,
      ))
      .orderBy(desc(vocabularyTable.createdAt))
      .limit(limit);
    return VocabularyFactory.createMany(rows);
  }

  async getStats(userId: string): Promise<{ total: number; new: number; learning: number; learned: number }> {
    const rows = await this.txHost.tx
      .select({
        status: vocabularyTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(vocabularyTable)
      .where(eq(vocabularyTable.userId, userId))
      .groupBy(vocabularyTable.status);

    const stats = { total: 0, new: 0, learning: 0, learned: 0 };
    for (const row of rows) {
      const key = row.status as keyof typeof stats;
      if (key in stats && key !== "total") stats[key] = row.count;
      stats.total += row.count;
    }
    return stats;
  }

  async getNewWordsCountForLesson(userId: string, lessonId: string): Promise<number> {
    const [result] = await this.txHost.tx
      .select({ count: sql<number>`count(*)::int` })
      .from(vocabularyTable)
      .where(and(eq(vocabularyTable.userId, userId), eq(vocabularyTable.lessonId, lessonId)));
    return result?.count ?? 0;
  }

  async getTopics(userId: string): Promise<string[]> {
    const rows = await this.txHost.tx
      .select({ topic: vocabularyTable.topic })
      .from(vocabularyTable)
      .where(and(eq(vocabularyTable.userId, userId), sql`${vocabularyTable.topic} IS NOT NULL`))
      .groupBy(vocabularyTable.topic);
    return rows.map((r) => r.topic).filter(Boolean) as string[];
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const result = await this.txHost.tx
      .delete(vocabularyTable)
      .where(and(eq(vocabularyTable.id, id), eq(vocabularyTable.userId, userId)))
      .returning({ id: vocabularyTable.id });
    return result.length > 0;
  }
}
```

**Step 2: Update contract**

Replace `vocabulary.contract.ts`:

```typescript
import { Injectable } from "@nestjs/common";
import { VocabularyRepository } from "../infrastructure/repository/vocabulary.repository";
import { VocabularyEntity } from "../domain/entity/vocabulary.entity";

@Injectable()
export class VocabularyContract {
  constructor(private vocabularyRepository: VocabularyRepository) {}

  async findRecentByUser(userId: string, limit = 20): Promise<VocabularyEntity[]> {
    return this.vocabularyRepository.findRecentByUser(userId, limit);
  }

  async findNotLearned(userId: string, limit = 30): Promise<VocabularyEntity[]> {
    return this.vocabularyRepository.findNotLearned(userId, limit);
  }

  async findByUser(
    userId: string,
    filters?: { status?: string; topic?: string; lessonId?: string },
    offset?: number,
    limit?: number,
  ): Promise<VocabularyEntity[]> {
    return this.vocabularyRepository.findByUser(userId, filters, offset, limit);
  }

  async upsert(data: {
    userId: string;
    word: string;
    translation?: string;
    topic?: string;
    lessonId?: string;
  }): Promise<VocabularyEntity> {
    return this.vocabularyRepository.upsert(data);
  }

  async incrementReview(userId: string, words: string[]): Promise<void> {
    return this.vocabularyRepository.incrementReview(userId, words);
  }

  async getStats(userId: string): Promise<{ total: number; new: number; learning: number; learned: number }> {
    return this.vocabularyRepository.getStats(userId);
  }

  async getNewWordsCountForLesson(userId: string, lessonId: string): Promise<number> {
    return this.vocabularyRepository.getNewWordsCountForLesson(userId, lessonId);
  }

  async getTopics(userId: string): Promise<string[]> {
    return this.vocabularyRepository.getTopics(userId);
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    return this.vocabularyRepository.deleteById(id, userId);
  }
}
```

**Step 3: Commit**

```bash
git add apps/api/src/@logic/vocabulary/
git commit -m "feat(vocabulary): update repository and contract for new schema"
```

---

### Task 3: Add Vocabulary REST Controller

**Files:**
- Create: `apps/api/src/@logic/vocabulary/presentation/controller/vocabulary.controller.ts`
- Modify: `apps/api/src/@logic/vocabulary/vocabulary.module.ts`

**Step 1: Create controller**

```typescript
import { Controller, Get, Delete, Param, Query, UseGuards, NotFoundException } from "@nestjs/common";
import { JwtAuthGuard } from "@shared/shared-auth/jwt-auth.guard";
import { CurrentUserId } from "@shared/shared-auth/current-user.decorator";
import { VocabularyContract } from "../../contract/vocabulary.contract";

@Controller("vocabulary")
@UseGuards(JwtAuthGuard)
export class VocabularyController {
  constructor(private vocabularyContract: VocabularyContract) {}

  @Get()
  async list(
    @CurrentUserId() userId: string,
    @Query("status") status?: string,
    @Query("topic") topic?: string,
    @Query("lessonId") lessonId?: string,
    @Query("offset") rawOffset?: string,
    @Query("limit") rawLimit?: string,
  ) {
    const offset = Math.max(0, Number(rawOffset) || 0);
    const limit = Math.min(100, Math.max(1, Number(rawLimit) || 50));
    const filters = {
      ...(status ? { status } : {}),
      ...(topic ? { topic } : {}),
      ...(lessonId ? { lessonId } : {}),
    };
    return this.vocabularyContract.findByUser(userId, filters, offset, limit);
  }

  @Get("stats")
  async stats(@CurrentUserId() userId: string) {
    return this.vocabularyContract.getStats(userId);
  }

  @Get("topics")
  async topics(@CurrentUserId() userId: string) {
    return this.vocabularyContract.getTopics(userId);
  }

  @Delete(":id")
  async remove(@CurrentUserId() userId: string, @Param("id") id: string) {
    const deleted = await this.vocabularyContract.deleteById(id, userId);
    if (!deleted) throw new NotFoundException("Word not found");
    return { success: true };
  }
}
```

**Step 2: Update vocabulary module to include controller and import auth**

```typescript
import { Module } from "@nestjs/common";
import { SharedDrizzlePgModule } from "@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedAuthModule } from "@shared/shared-auth/shared-auth.module";
import { VocabularyRepository } from "./infrastructure/repository/vocabulary.repository";
import { VocabularyContract } from "./contract/vocabulary.contract";
import { VocabularyController } from "./presentation/controller/vocabulary.controller";

@Module({
  imports: [SharedDrizzlePgModule, SharedAuthModule],
  controllers: [VocabularyController],
  providers: [VocabularyRepository, VocabularyContract],
  exports: [VocabularyContract],
})
export class VocabularyModule {}
```

**Step 3: Commit**

```bash
git add apps/api/src/@logic/vocabulary/
git commit -m "feat(vocabulary): add REST controller with list, stats, topics, delete endpoints"
```

---

### Task 4: Update Shared Schemas — PostLessonLlmResponse

**Files:**
- Modify: `packages/shared/src/schemas/lesson.ts`

**Step 1: Update the schema**

Change `newWords` from `z.array(z.string())` to structured objects, and add `reviewedWords`:

```typescript
// In PostLessonLlmResponseSchema, replace:
//   newWords: z.array(z.string()),
// With:
  newWords: z.array(
    z.object({
      word: z.string(),
      translation: z.string(),
      topic: z.string(),
    }),
  ),
  reviewedWords: z.array(z.string()).default([]),
```

Also update `LessonSummarySchema.newWords` to match (or keep as string[] for lesson display — extract just words):

The `LessonSummarySchema.newWords` stays as `z.array(z.string())` since that's the lesson table column type. Only `PostLessonLlmResponseSchema` changes.

**Step 2: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): update PostLessonLlmResponse schema for vocabulary with translations"
```

---

### Task 5: Update Post-Lesson Job

**Files:**
- Modify: `apps/api/src/@logic/lesson/infrastructure/bull-handler/post-lesson.bull-handler.ts`

**Step 1: Update SUMMARY_PROMPT**

Change the JSON schema in the prompt to request structured vocabulary:

```typescript
const SUMMARY_PROMPT = `Analyze the full lesson conversation and generate a structured summary.
Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary",
  "topics": ["Human-readable topic names, e.g. Present Tense, Food Vocabulary, Travel Phrases"],
  "newWords": [{"word": "reluctant", "translation": "неохотный", "topic": "emotions"}],
  "reviewedWords": ["words the student successfully recalled or used correctly from previous lessons"],
  "errorsFound": [{"text": "error", "correction": "correct", "topic": "topic"}],
  "emotionalSummary": "student mood description",
  "levelAssessment": "A1|A2|B1|B2|C1|C2 or null",
  "suggestedNextTopics": ["topics"]
}

IMPORTANT for newWords:
- Include the translation in the student's native language (shown in conversation context)
- Assign a topic category (e.g. "emotions", "travel", "food", "business", "daily life", "grammar")
- Only include words that were NEW to the student or that they asked about

IMPORTANT for reviewedWords:
- Include words the student successfully used or translated from their existing vocabulary
- Only count it if the student demonstrated knowledge (not just heard the word)`;
```

**Step 2: Update savePostLessonData — vocabulary section**

Replace the vocabulary loop (lines 102-110) with:

```typescript
    const newWordStrings: string[] = [];
    for (const wordEntry of summary.newWords) {
      newWordStrings.push(wordEntry.word);
      await this.vocabularyContract.upsert({
        userId: lesson.userId,
        word: wordEntry.word,
        translation: wordEntry.translation,
        topic: wordEntry.topic,
        lessonId,
      });
    }

    if (summary.reviewedWords.length > 0) {
      await this.vocabularyContract.incrementReview(lesson.userId, summary.reviewedWords);
    }
```

Also update the `lessonRepository.complete()` call — `newWords` field needs just strings for the lesson table:

```typescript
    await this.lessonRepository.complete(lessonId, {
      summary: summary.summary,
      topics: summary.topics,
      newWords: summary.newWords.map((w) => w.word),
      // ... rest stays the same
    });
```

**Step 3: Commit**

```bash
git add apps/api/src/@logic/lesson/infrastructure/bull-handler/post-lesson.bull-handler.ts
git commit -m "feat(vocabulary): update post-lesson job for structured vocabulary with translations"
```

---

### Task 6: Add Vocab Tag Parsing in StreamingPipeline

**Files:**
- Create: `apps/api/src/@logic/lesson/application/service/vocab-tags.ts`
- Modify: `apps/api/src/@logic/lesson/application/service/streaming-pipeline.service.ts`
- Modify: `apps/api/src/@logic/lesson/application/service/streaming-pipeline.service.ts` — `StreamCallbacks`

**Step 1: Create vocab tag parser**

```typescript
// vocab-tags.ts
export interface VocabHighlight {
  word: string;
  translation: string;
  topic: string;
}

const VOCAB_TAG_RE = /<vocab\s+word="([^"]+)"\s+translation="([^"]+)"\s+topic="([^"]+)"\s*\/>/g;
const VOCAB_REVIEWED_RE = /<vocab_reviewed\s+word="([^"]+)"\s*\/>/g;

export function extractVocabTags(text: string): {
  cleanText: string;
  highlights: VocabHighlight[];
  reviewedWords: string[];
} {
  const highlights: VocabHighlight[] = [];
  const reviewedWords: string[] = [];

  let cleanText = text.replaceAll(VOCAB_TAG_RE, (_, word: string, translation: string, topic: string) => {
    highlights.push({ word, translation, topic });
    return "";
  });

  cleanText = cleanText.replaceAll(VOCAB_REVIEWED_RE, (_, word: string) => {
    reviewedWords.push(word);
    return "";
  });

  return { cleanText: cleanText.trim(), highlights, reviewedWords };
}
```

**Step 2: Add callbacks to StreamCallbacks interface**

In `streaming-pipeline.service.ts`, add to `StreamCallbacks`:

```typescript
export interface StreamCallbacks {
  onChunk(chunk: StreamChunk): void;
  onEnd(result: StreamResult): void;
  onError(error: Error): void;
  onDiscard?(safetyText: string): void;
  onSpeedChange?(speed: string): void;
  onEmotion?(emotion: string): void;
  onVocabHighlight?(highlight: { word: string; translation: string; topic: string }): void;
  onVocabReviewed?(word: string): void;
}
```

**Step 3: No changes to StreamingPipeline itself** — tag extraction happens in `LessonMaintainer.processTextMessageStreaming` where chunks are already processed. The pipeline passes raw text; the maintainer strips tags.

**Step 4: Commit**

```bash
git add apps/api/src/@logic/lesson/application/service/vocab-tags.ts apps/api/src/@logic/lesson/application/service/streaming-pipeline.service.ts
git commit -m "feat(vocabulary): add vocab tag parser and streaming callbacks"
```

---

### Task 7: Integrate Vocab Tags in LessonMaintainer

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts`

**Step 1: Import and use vocab tag parser**

Add import:
```typescript
import { extractVocabTags } from "../service/vocab-tags";
```

In `processTextMessageStreaming`, update the `onChunk` callback (around line 171):

```typescript
        onChunk: (chunk) => {
          const { cleanText: noSpeed } = stripSpeedTags(chunk.text);
          const { text: noEmotion } = parseEmotion(noSpeed);
          const { cleanText, highlights, reviewedWords } = extractVocabTags(noEmotion);

          for (const h of highlights) callbacks.onVocabHighlight?.(h);
          for (const w of reviewedWords) callbacks.onVocabReviewed?.(w);

          if (cleanText) {
            callbacks.onChunk({ ...chunk, text: cleanText });
          }
        },
```

Also update the `onEnd` callback — strip vocab tags from fullText:

```typescript
            const { cleanText: textWithoutSpeed, speed } = stripSpeedTags(result.fullText);
            const { text: textWithoutEmotion } = parseEmotion(textWithoutSpeed);
            const { cleanText } = extractVocabTags(textWithoutEmotion);
```

Use `cleanText` instead of the old variable name in the rest of onEnd.

**Step 2: Commit**

```bash
git add apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts
git commit -m "feat(vocabulary): integrate vocab tag parsing in lesson streaming"
```

---

### Task 8: Add Vocab Events to WebSocket Gateway

**Files:**
- Modify: `apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts`

**Step 1: Add vocab callbacks in handleText**

In `handleText`, add to the callbacks object (after `onEmotion`):

```typescript
        onVocabHighlight: (highlight) => {
          client.emit("vocab_highlight", highlight);
        },
        onVocabReviewed: (word) => {
          client.emit("vocab_reviewed", { word });
        },
```

**Step 2: Commit**

```bash
git add apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts
git commit -m "feat(vocabulary): emit vocab_highlight and vocab_reviewed WebSocket events"
```

---

### Task 9: Update System Prompt with Vocabulary Instructions

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/service/prompt-builder.ts`
- Modify: `apps/api/src/@logic/lesson/application/dto/lesson-context.ts`
- Modify: `apps/api/src/@logic/lesson/application/service/lesson-context.service.ts`

**Step 1: Update LessonContext DTO**

Add `vocabularyToReview` and `nativeLanguage` to the interface:

```typescript
export interface LessonContext {
  // ... existing fields ...
  nativeLanguage: string;
  learningFocus: {
    weakAreas: string[];
    strongAreas: string[];
    recentWords: string[];
    suggestedTopics: string[];
    vocabularyToReview: Array<{ word: string; translation: string; reviewCount: number }>;
  };
}
```

**Step 2: Update LessonContextService.build()**

Change `recentVocab` to `vocabToReview` using `findNotLearned`:

```typescript
    const [user, grammarProgress, vocabToReview, lessonCount, recentLessons] = await Promise.all([
      this.authContract.findByIdWithPreferences(userId),
      this.progressContract.findByUser(userId),
      this.vocabularyContract.findNotLearned(userId, 30),
      this.lessonRepository.countByUser(userId),
      this.lessonRepository.findRecentByUser(userId, 1),
    ]);
```

In the returned context, update `learningFocus`:

```typescript
      learningFocus: {
        weakAreas: grammarProgress.filter((g) => g.level < 50).map((g) => g.topic),
        strongAreas: grammarProgress.filter((g) => g.level >= 70).map((g) => g.topic),
        recentWords: vocabToReview.map((v) => v.word),
        suggestedTopics,
        vocabularyToReview: vocabToReview.map((v) => ({
          word: v.word,
          translation: v.translation ?? "",
          reviewCount: v.reviewCount,
        })),
      },
```

Add `nativeLanguage`:
```typescript
      nativeLanguage: user.users.nativeLanguage ?? "Russian",
```

**Step 3: Update prompt-builder.ts**

Add vocabulary instruction block to `JAKE_BASE_PROMPT` (after ACTIVE RECALL section):

```typescript
=== VOCABULARY TAGS ===
When you introduce a new word, explain a word, or the student asks for a translation, use this tag:
<vocab word="reluctant" translation="неохотный" topic="emotions"/>

Rules:
- ALWAYS include word, translation (in student's native language), and topic
- topic is a category: emotions, travel, food, business, daily_life, grammar, technology, health, education, culture, etc.
- Before starting a new topic, suggest 3-5 key words using <vocab> tags
- When student asks "what does X mean?" or "how do you say X?" — use <vocab> tag
- Place tags INLINE in your response, right where you mention the word
- The tag will be stripped from speech — the student will see a visual card

When a student successfully recalls or correctly uses a word from their vocabulary, use:
<vocab_reviewed word="reluctant"/>

Rules:
- Only use when the student demonstrates knowledge (used correctly in a sentence, translated correctly)
- Don't use when YOU say the word — only when the STUDENT does
```

Update the `=== LEARNING FOCUS ===` section in `buildFullSystemPrompt`:

```typescript
  if (context.learningFocus.vocabularyToReview.length > 0) {
    const vocabList = context.learningFocus.vocabularyToReview
      .map((v) => `- ${v.word} (${v.translation}) — reviewed ${v.reviewCount}/5 times`)
      .join("\n");
    parts.push(`\n=== VOCABULARY TO REVIEW ===
The student is learning these words. Periodically check if they remember them (ask translation, use in context).
Student's native language: ${context.nativeLanguage}
${vocabList}`);
  }
```

**Step 4: Commit**

```bash
git add apps/api/src/@logic/lesson/application/
git commit -m "feat(vocabulary): add vocab tags to system prompt and vocabulary review context"
```

---

### Task 10: Frontend — API Client & Types

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/types/index.ts`

**Step 1: Add types**

Add to `apps/web/src/types/index.ts`:

```typescript
export interface VocabularyItem {
  id: string;
  word: string;
  translation: string | null;
  topic: string | null;
  status: "new" | "learning" | "learned";
  reviewCount: number;
  lastReviewedAt: string | null;
  lessonId: string | null;
  createdAt: string;
}

export interface VocabularyStats {
  total: number;
  new: number;
  learning: number;
  learned: number;
}
```

**Step 2: Add API methods**

Add to `api` object in `apps/web/src/lib/api.ts`:

```typescript
  vocabulary: {
    list: (params?: { status?: string; topic?: string; lessonId?: string; offset?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.status) query.set("status", params.status);
      if (params?.topic) query.set("topic", params.topic);
      if (params?.lessonId) query.set("lessonId", params.lessonId);
      if (params?.offset) query.set("offset", String(params.offset));
      if (params?.limit) query.set("limit", String(params.limit));
      const qs = query.toString();
      return request<VocabularyItem[]>(`/vocabulary${qs ? `?${qs}` : ""}`);
    },
    stats: () => request<VocabularyStats>("/vocabulary/stats"),
    topics: () => request<string[]>("/vocabulary/topics"),
    delete: (id: string) => request<{ success: boolean }>(`/vocabulary/${id}`, { method: "DELETE" }),
  },
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/types/index.ts
git commit -m "feat(web): add vocabulary API client and types"
```

---

### Task 11: Frontend — Vocabulary Widget on Dashboard

**Files:**
- Create: `apps/web/src/components/VocabularyWidget.tsx`
- Modify: `apps/web/src/app/(app)/dashboard/page.tsx`

**Step 1: Create VocabularyWidget**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { VocabularyStats } from "@/types";

export function VocabularyWidget() {
  const router = useRouter();
  const [stats, setStats] = useState<VocabularyStats | null>(null);

  useEffect(() => {
    void api.vocabulary.stats().then(setStats).catch(() => {});
  }, []);

  if (!stats || stats.total === 0) return null;

  const learnedPercent = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={() => { router.push("/vocabulary"); }}
      className="w-full text-left group bg-white rounded-2xl border border-gray-100 p-5 hover:border-primary-200 hover:shadow-md hover:shadow-primary-900/5 transition-all duration-200"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Vocabulary</h3>
        <svg className="w-4 h-4 text-gray-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.learned}</p>
          <p className="text-xs text-gray-400 mt-0.5">Learned</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-500">{stats.new + stats.learning}</p>
          <p className="text-xs text-gray-400 mt-0.5">In progress</p>
        </div>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${learnedPercent}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1.5 text-right">{learnedPercent}% learned</p>
    </button>
  );
}
```

**Step 2: Add widget to dashboard**

In `dashboard/page.tsx`, import and place between the CTA button and lessons list:

```tsx
import { VocabularyWidget } from "@/components/VocabularyWidget";
```

Add after the Start Lesson button (around line 134):

```tsx
      {/* Vocabulary Widget */}
      <div className="opacity-0 animate-slide-up animate-stagger-3">
        <VocabularyWidget />
      </div>
```

Update the lesson section stagger class from `animate-stagger-4` to `animate-stagger-5` (or keep as-is if stagger classes are not sequential).

**Step 3: Commit**

```bash
git add apps/web/src/components/VocabularyWidget.tsx apps/web/src/app/(app)/dashboard/page.tsx
git commit -m "feat(web): add vocabulary widget to dashboard"
```

---

### Task 12: Frontend — Vocabulary Page

**Files:**
- Create: `apps/web/src/app/(app)/vocabulary/page.tsx`

**Step 1: Create the page**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import type { VocabularyItem, VocabularyStats } from "@/types";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-700" },
  learning: { label: "Learning", color: "bg-amber-100 text-amber-700" },
  learned: { label: "Learned", color: "bg-emerald-100 text-emerald-700" },
};

function ReviewDots({ count }: { count: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i < count ? "bg-emerald-500" : "bg-gray-200"}`}
        />
      ))}
    </div>
  );
}

export default function VocabularyPage() {
  const [words, setWords] = useState<VocabularyItem[]>([]);
  const [stats, setStats] = useState<VocabularyStats | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [topicFilter, setTopicFilter] = useState<string>("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters: Record<string, string> = {};
      if (statusFilter) filters.status = statusFilter;
      if (topicFilter) filters.topic = topicFilter;

      const [wordsData, statsData, topicsData] = await Promise.all([
        api.vocabulary.list(filters),
        api.vocabulary.stats(),
        api.vocabulary.topics(),
      ]);
      setWords(wordsData);
      setStats(statsData);
      setTopics(topicsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, topicFilter]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    try {
      await api.vocabulary.delete(id);
      setWords((prev) => prev.filter((w) => w.id !== id));
      if (stats) {
        setStats({ ...stats, total: stats.total - 1 });
      }
    } catch {}
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="pt-2 opacity-0 animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Vocabulary</h1>
      </div>

      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="opacity-0 animate-slide-up animate-stagger-2 grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-gray-900" },
            { label: "New", value: stats.new, color: "text-blue-600" },
            { label: "Learning", value: stats.learning, color: "text-amber-500" },
            { label: "Learned", value: stats.learned, color: "text-emerald-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="opacity-0 animate-slide-up animate-stagger-3 flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); }}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="learning">Learning</option>
          <option value="learned">Learned</option>
        </select>

        <select
          value={topicFilter}
          onChange={(e) => { setTopicFilter(e.target.value); }}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Loading / Error */}
      {isLoading && <LoadingSpinner className="h-32" />}
      {error && <ErrorMessage message={error} onRetry={() => { void fetchData(); }} />}

      {/* Word list */}
      {!isLoading && words.length > 0 && (
        <div className="opacity-0 animate-slide-up animate-stagger-4 space-y-2">
          {words.map((word, i) => {
            const statusInfo = STATUS_LABELS[word.status] ?? STATUS_LABELS.new!;
            return (
              <div
                key={word.id}
                style={i < 20 ? { animationDelay: `${(i + 5) * 0.03}s` } : undefined}
                className={`${i < 20 ? "opacity-0 animate-slide-up" : ""} bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 hover:border-gray-200 transition-colors`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{word.word}</span>
                    {word.topic && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{word.topic}</span>
                    )}
                  </div>
                  {word.translation && (
                    <p className="text-sm text-gray-400 mt-0.5">{word.translation}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <ReviewDots count={word.reviewCount} />
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => { void handleDelete(word.id); }}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1"
                    title="Remove word"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && words.length === 0 && !error && (
        <div className="text-center py-16">
          <p className="text-2xl font-bold text-gray-300 mb-2">No words yet</p>
          <p className="text-gray-400 text-sm">Words will appear here after your lessons</p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/(app)/vocabulary/
git commit -m "feat(web): add vocabulary page with filters, stats, and word list"
```

---

### Task 13: Frontend — Vocab Cards on Lesson Screen

**Files:**
- Create: `apps/web/src/components/lesson/VocabCard.tsx`
- Modify: `apps/web/src/hooks/useLessonState.ts` (or wherever WebSocket events are handled)
- Modify: `apps/web/src/components/lesson/LessonScreen.tsx`

**Step 1: Find the WebSocket event handler**

Look in `useLessonState.ts` for where `socket.on("tutor_chunk", ...)` etc. are registered. Add handlers for `vocab_highlight` and `vocab_reviewed`.

**Step 2: Create VocabCard component**

```tsx
"use client";

import { useState, useEffect } from "react";

interface VocabHighlight {
  word: string;
  translation: string;
  topic: string;
}

interface VocabCardProps {
  highlights: VocabHighlight[];
  reviewedWords: string[];
}

export function VocabCard({ highlights, reviewedWords }: VocabCardProps) {
  if (highlights.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 flex flex-wrap gap-2 justify-center max-w-md">
      {highlights.slice(-5).map((h, i) => {
        const isReviewed = reviewedWords.includes(h.word);
        return (
          <div
            key={`${h.word}-${i}`}
            className={`animate-fade-in px-3 py-2 rounded-xl border backdrop-blur-sm shadow-lg transition-all duration-300 ${
              isReviewed
                ? "bg-emerald-50/90 border-emerald-200"
                : "bg-white/90 border-gray-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {isReviewed && (
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              <span className="font-medium text-gray-900 text-sm">{h.word}</span>
              <span className="text-gray-400 text-sm">—</span>
              <span className="text-gray-500 text-sm">{h.translation}</span>
            </div>
            <span className="text-xs text-gray-400">{h.topic}</span>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3:** Integrate into `useLessonState` — add state for `vocabHighlights` and `reviewedWords`, listen to socket events `vocab_highlight` and `vocab_reviewed`.

**Step 4:** Add `<VocabCard>` to `LessonScreen.tsx`.

**Step 5: Commit**

```bash
git add apps/web/src/components/lesson/VocabCard.tsx apps/web/src/hooks/useLessonState.ts apps/web/src/components/lesson/LessonScreen.tsx
git commit -m "feat(web): show vocab cards during lesson via WebSocket events"
```

---

### Task 14: Verify & Fix Types

**Step 1: Run type-check**

Run: `pnpm type-check`
Expected: No errors. Fix any that appear.

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors. Fix any that appear.

**Step 3: Commit fixes if any**

```bash
git commit -m "fix: resolve type-check and lint issues"
```

---

### Task 15: Test & Create PR

**Step 1: Run API tests**

Run: `pnpm --filter @jake/api test`
Expected: All pass (fix any failures from schema changes)

**Step 2: Run web tests**

Run: `pnpm --filter @jake/web test`
Expected: All pass

**Step 3: Build**

Run: `pnpm build`
Expected: Successful build

**Step 4: Push and create PR**

```bash
git push -u origin feat/vocabulary-system
gh pr create --title "feat: vocabulary system with real-time cards, dashboard widget, and vocabulary page" --body "$(cat <<'EOF'
## Summary
- Updated vocabulary table schema: added translation, topic, status, review_count fields
- Added `<vocab>` and `<vocab_reviewed>` tags for Claude to use during lessons
- Real-time vocab cards shown during lessons via WebSocket events
- Post-lesson job saves vocabulary with translations and topics
- Spaced repetition: word marked as "learned" after 5 successful reviews
- REST API endpoints: GET /vocabulary, GET /vocabulary/stats, GET /vocabulary/topics, DELETE /vocabulary/:id
- Dashboard widget showing vocabulary stats
- Full vocabulary page with filters (status, topic) and progress dots

## Test plan
- [ ] Start a lesson, ask "what does reluctant mean?" — verify vocab card appears
- [ ] Complete a lesson — verify words saved with translations in DB
- [ ] Check dashboard — verify vocabulary widget shows stats
- [ ] Open /vocabulary page — verify word list with filters works
- [ ] Delete a word from vocabulary page
- [ ] Verify word status changes to "learned" after 5 reviews

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
