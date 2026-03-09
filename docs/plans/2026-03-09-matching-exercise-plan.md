# Matching Exercise Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add interactive word-definition matching exercises during voice lessons, with tutor hints via voice.

**Architecture:** Claude emits `<exercise type="matching">` XML tags in responses. Backend extracts the tag from the stream (like vocab tags), stores exercise in Redis session, emits WebSocket event. Frontend renders interactive matching UI. Student answers are validated server-side with instant feedback, then added to Claude's history so the tutor can comment.

**Tech Stack:** NestJS (backend tag extraction, WS events, session), React (matching UI component), Tailwind CSS (styling)

---

### Task 1: Exercise tag extractor (backend)

**Files:**
- Create: `apps/api/src/@logic/lesson/application/service/exercise-tags.ts`
- Test: `apps/api/src/@logic/lesson/application/service/exercise-tags.spec.ts`

**Step 1: Write the failing test**

```typescript
// exercise-tags.spec.ts
import { extractExerciseTag, ExerciseTagBuffer } from "./exercise-tags";

describe("extractExerciseTag", () => {
  it("extracts a matching exercise from text", () => {
    const text = `Let's practice! Try matching these words.
<exercise type="matching">
  <pair word="resilient" definition="able to recover quickly from difficulties"/>
  <pair word="reluctant" definition="unwilling and hesitant"/>
</exercise>`;

    const result = extractExerciseTag(text);
    expect(result.cleanText).toBe("Let's practice! Try matching these words.");
    expect(result.exercise).toEqual({
      type: "matching",
      pairs: [
        { word: "resilient", definition: "able to recover quickly from difficulties" },
        { word: "reluctant", definition: "unwilling and hesitant" },
      ],
    });
  });

  it("returns null exercise when no tag present", () => {
    const result = extractExerciseTag("Just a normal response.");
    expect(result.cleanText).toBe("Just a normal response.");
    expect(result.exercise).toBeNull();
  });

  it("handles single-line pairs", () => {
    const text = `Practice time! <exercise type="matching"><pair word="a" definition="b"/><pair word="c" definition="d"/></exercise>`;
    const result = extractExerciseTag(text);
    expect(result.exercise?.pairs).toHaveLength(2);
    expect(result.cleanText).toBe("Practice time!");
  });
});

describe("ExerciseTagBuffer", () => {
  it("buffers incomplete exercise tag across chunks", () => {
    const buffer = new ExerciseTagBuffer();

    const r1 = buffer.push("Let's practice! <exercise typ");
    expect(r1.cleanText).toBe("Let's practice! ");
    expect(r1.exercise).toBeNull();

    const r2 = buffer.push('e="matching"><pair word="a" definition="b"/></exercise>');
    expect(r2.exercise).toEqual({
      type: "matching",
      pairs: [{ word: "a", definition: "b" }],
    });
  });

  it("passes through text when no exercise tag", () => {
    const buffer = new ExerciseTagBuffer();
    const r = buffer.push("Hello, how are you?");
    expect(r.cleanText).toBe("Hello, how are you?");
    expect(r.exercise).toBeNull();
  });

  it("flushes remaining buffer", () => {
    const buffer = new ExerciseTagBuffer();
    buffer.push("Some text <exercise");
    const r = buffer.flush();
    // Incomplete tag — just return as text
    expect(r.cleanText).toBe("<exercise");
    expect(r.exercise).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @jake/api test -- --testPathPattern exercise-tags`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// exercise-tags.ts
export interface ExercisePair {
  word: string;
  definition: string;
}

export interface ParsedExercise {
  type: "matching";
  pairs: ExercisePair[];
}

const EXERCISE_TAG_RE = /<exercise\s+type="matching">([\s\S]*?)<\/exercise>/;
const PAIR_RE = /<pair\s+word="([^"]+)"\s+definition="([^"]+)"\s*\/>/g;

export function extractExerciseTag(text: string): {
  cleanText: string;
  exercise: ParsedExercise | null;
} {
  const match = EXERCISE_TAG_RE.exec(text);
  if (!match) return { cleanText: text.trim(), exercise: null };

  const pairs: ExercisePair[] = [];
  const inner = match[1] ?? "";

  // Reset lastIndex for global regex
  PAIR_RE.lastIndex = 0;
  let pairMatch: RegExpExecArray | null;
  while ((pairMatch = PAIR_RE.exec(inner)) !== null) {
    pairs.push({ word: pairMatch[1]!, definition: pairMatch[2]! });
  }

  if (pairs.length === 0) return { cleanText: text.trim(), exercise: null };

  const cleanText = text.replace(EXERCISE_TAG_RE, "").trim();
  return { cleanText, exercise: { type: "matching", pairs } };
}

/**
 * Streaming-safe exercise tag extractor. Buffers incomplete tags across chunks.
 */
export class ExerciseTagBuffer {
  private buffer = "";

  push(chunk: string): { cleanText: string; exercise: ParsedExercise | null } {
    this.buffer += chunk;

    const lastOpenBracket = this.buffer.lastIndexOf("<");

    if (lastOpenBracket !== -1) {
      const afterOpen = this.buffer.slice(lastOpenBracket);
      // If it looks like an exercise tag starting but not closed yet
      if (afterOpen.startsWith("<exercise") && !afterOpen.includes("</exercise>")) {
        const safeText = this.buffer.slice(0, lastOpenBracket);
        this.buffer = afterOpen;
        return { cleanText: safeText, exercise: null };
      }
    }

    // Check for complete exercise tag
    const result = extractExerciseTag(this.buffer);
    if (result.exercise) {
      this.buffer = "";
      return result;
    }

    // No tag found — if there might be a partial one starting, buffer it
    if (lastOpenBracket !== -1) {
      const afterOpen = this.buffer.slice(lastOpenBracket);
      if (afterOpen.startsWith("<e") || afterOpen.startsWith("<ex")) {
        const safeText = this.buffer.slice(0, lastOpenBracket);
        this.buffer = afterOpen;
        return { cleanText: safeText, exercise: null };
      }
    }

    const text = this.buffer;
    this.buffer = "";
    return { cleanText: text, exercise: null };
  }

  flush(): { cleanText: string; exercise: ParsedExercise | null } {
    const result = extractExerciseTag(this.buffer);
    this.buffer = "";
    return result;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @jake/api test -- --testPathPattern exercise-tags`
Expected: PASS

**Step 5: Commit**

Message: `feat(exercise): add exercise tag extractor with streaming buffer`

---

### Task 2: Add activeExercise to session (backend)

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/service/lesson-session.service.ts`

**Step 1: Add activeExercise to LessonSession interface and add helper methods**

1. Import `ParsedExercise` from `./exercise-tags`
2. Add to `LessonSession` interface:
```typescript
activeExercise?: {
  id: string;
  exercise: ParsedExercise;
} | null;
```
3. Add methods:
```typescript
async setActiveExercise(userId: string, exerciseId: string, exercise: ParsedExercise): Promise<void> {
  const session = await this.get(userId);
  if (!session) return;
  session.activeExercise = { id: exerciseId, exercise };
  await this.save(userId, session);
}

async clearActiveExercise(userId: string): Promise<void> {
  const session = await this.get(userId);
  if (!session) return;
  session.activeExercise = null;
  await this.save(userId, session);
}
```

**Step 2: Commit**

Message: `feat(exercise): add activeExercise to lesson session`

---

### Task 3: Add onExercise callback and integrate into streaming pipeline (backend)

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/service/streaming-pipeline.service.ts` (add `onExercise` to `StreamCallbacks`)
- Modify: `apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts` (integrate ExerciseTagBuffer)

**Step 1: Add `onExercise` to `StreamCallbacks`**

In `streaming-pipeline.service.ts`, add to the `StreamCallbacks` interface:
```typescript
onExercise?: (exercise: { id: string; type: string; pairs: Array<{ word: string; definition: string }> }) => void;
```

**Step 2: Integrate ExerciseTagBuffer into lesson maintainer**

In `lesson.maintainer.ts`:

1. Import `ExerciseTagBuffer, extractExerciseTag` from `../service/exercise-tags`
2. Import `randomUUID` from `node:crypto`
3. In `processTextMessageStreaming()`, after `const vocabBuffer = new VocabTagBuffer();` add:
```typescript
const exerciseBuffer = new ExerciseTagBuffer();
```
4. In the `onChunk` callback, after vocab buffer processing, add exercise buffer step. Replace the existing `if (cleanText)` block with:
```typescript
const { cleanText: finalText, exercise } = exerciseBuffer.push(cleanText);
if (exercise) {
  const exerciseId = randomUUID();
  void this.sessionService.setActiveExercise(userId, exerciseId, exercise);
  callbacks.onExercise?.({ id: exerciseId, type: exercise.type, pairs: exercise.pairs });
}
if (finalText) {
  callbacks.onChunk({ ...chunk, text: finalText });
}
```

5. In the `onEnd` callback, after vocab flush, add exercise flush:
```typescript
const exerciseRemaining = exerciseBuffer.flush();
if (exerciseRemaining.exercise) {
  const exerciseId = randomUUID();
  void this.sessionService.setActiveExercise(userId, exerciseId, exerciseRemaining.exercise);
  callbacks.onExercise?.({ id: exerciseId, type: exerciseRemaining.exercise.type, pairs: exerciseRemaining.exercise.pairs });
}
if (exerciseRemaining.cleanText) {
  callbacks.onChunk({ chunkIndex: -1, text: exerciseRemaining.cleanText });
}
```

6. In the `onEnd` async block, also strip exercise tags from fullText. After `stripOnboardingTags`, add:
```typescript
const { cleanText: textWithoutExercise } = extractExerciseTag(textWithoutOnboarding);
```
Then use `textWithoutExercise` instead of `textWithoutOnboarding` in the next line.

**Step 3: Run tests**

Run: `pnpm --filter @jake/api test`
Expected: PASS (no breaking changes)

**Step 4: Commit**

Message: `feat(exercise): integrate exercise tag extraction into streaming pipeline`

---

### Task 4: Add exercise_answer handler to gateway (backend)

**Files:**
- Modify: `apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts`

**Step 1: Add Zod schema for exercise_answer**

```typescript
const wsExerciseAnswerSchema = z.object({
  exerciseId: z.string().uuid(),
  answers: z.array(z.object({
    word: z.string(),
    definition: z.string(),
  })),
});
```

**Step 2: Add exercise_answer handler**

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

  const userId = this.getUserId(client);
  const session = await this.sessionService.get(userId);
  if (!session?.activeExercise || session.activeExercise.id !== parsed.data.exerciseId) {
    client.emit("error", { message: "No active exercise" });
    return;
  }

  const { exercise } = session.activeExercise;
  const results = exercise.pairs.map((pair) => {
    const studentAnswer = parsed.data.answers.find((a) => a.word === pair.word);
    return {
      word: pair.word,
      correct: studentAnswer?.definition === pair.definition,
      correctDefinition: pair.definition,
    };
  });

  const correctCount = results.filter((r) => r.correct).length;
  const score = `${correctCount}/${results.length}`;

  client.emit("exercise_feedback", {
    exerciseId: parsed.data.exerciseId,
    results,
    score,
  });

  // Add result to Claude's history so tutor can comment
  const mistakes = results
    .filter((r) => !r.correct)
    .map((r) => {
      const studentDef = parsed.data.answers.find((a) => a.word === r.word)?.definition ?? "no answer";
      return `"${r.word}" -> student matched with "${studentDef}" (correct: "${r.correctDefinition}")`;
    });

  const historyEntry = mistakes.length > 0
    ? `[Exercise result: ${score} correct. Mistakes: ${mistakes.join("; ")}]`
    : `[Exercise result: ${score} correct. Perfect score!]`;

  await this.sessionService.appendHistory(userId, { role: "user", content: historyEntry });
  await this.sessionService.clearActiveExercise(userId);
}
```

**Step 3: Add onExercise callback in handleText**

In the `handleText` method's callbacks object, add alongside other callbacks:
```typescript
onExercise: (exercise) => {
  client.emit("exercise", exercise);
},
```

**Step 4: Run tests**

Run: `pnpm --filter @jake/api test`
Expected: PASS

**Step 5: Commit**

Message: `feat(exercise): add exercise WS event emission and answer handler`

---

### Task 5: Add exercise instructions to system prompt (backend)

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/service/prompt-builder.ts`

**Step 1: Add exercise section constant**

After `CORRECTION_RULES`, add:

```typescript
const EXERCISE_PROMPT = `
=== MATCHING EXERCISES ===
You can give the student word-definition matching exercises using <exercise> tags.
The system renders them as interactive cards — the student connects words to definitions visually.

FORMAT:
<exercise type="matching">
  <pair word="resilient" definition="able to recover quickly from difficulties"/>
  <pair word="reluctant" definition="unwilling and hesitant"/>
  <pair word="ambiguous" definition="open to more than one interpretation"/>
</exercise>

WHEN to give an exercise:
- After explaining 3+ new words in conversation — suggest: "Want to try a quick matching exercise?"
- When the student asks to practice ("give me an exercise", "let's practice")
- Maximum ONE exercise per 10 messages — don't spam
- NEVER during onboarding

HOW to form pairs:
- Use words from the current conversation (priority)
- Fill remaining slots from VOCABULARY TO REVIEW section (words the student is learning)
- Number of pairs by level: A1-A2 -> 3 pairs, B1-B2 -> 4-5 pairs, C1-C2 -> 5-6 pairs
- Definitions in simple English, adapted to the student's level

IMPORTANT:
- Always say something BEFORE the <exercise> tag — introduce the exercise vocally ("Let's see if you remember these!")
- The <exercise> tag itself is NOT spoken — it's rendered as an interactive UI
- Place the tag at the END of your message, after all spoken text
- Only ONE <exercise> tag per message

HINTS:
- If the student asks for a hint ("help me", "give me a hint") and there's an active exercise, give a hint:
  - Synonym or related word
  - Example sentence using the word
  - First letter of the definition
  - Category or context clue
- Do NOT give the direct answer — help them figure it out
- You can give multiple hints, each more explicit than the last

AFTER EXERCISE RESULT:
- The system will add "[Exercise result: 3/4 correct. Mistakes: ...]" to the conversation
- Comment on the result: praise correct ones, briefly explain the mistakes
- Give a usage example for words they got wrong
- Then smoothly return to conversation`;
```

**Step 2: Add to buildFullSystemPrompt**

In `buildFullSystemPrompt`, after `parts.push(JAKE_BASE_PROMPT)` and tutor fragment, before STUDENT PROFILE:
```typescript
if (context.onboardingCompleted) {
  parts.push(EXERCISE_PROMPT);
}
```

**Step 3: Run prompt-builder tests**

Run: `pnpm --filter @jake/api test -- --testPathPattern prompt-builder`
Expected: PASS

**Step 4: Commit**

Message: `feat(exercise): add matching exercise instructions to system prompt`

---

### Task 6: Frontend types and event handling

**Files:**
- Modify: `apps/web/src/types/index.ts`
- Modify: `apps/web/src/hooks/lesson/handleLessonEvent.ts`

**Step 1: Add exercise types to `types/index.ts`**

After VocabHighlight interface, add:

```typescript
// Exercise types

export interface ExercisePair {
  word: string;
  definition: string;
}

export interface ExerciseData {
  exerciseId: string;
  type: "matching";
  pairs: ExercisePair[];
}

export interface ExerciseResult {
  word: string;
  correct: boolean;
  correctDefinition: string;
}

export interface ExerciseFeedbackData {
  exerciseId: string;
  results: ExerciseResult[];
  score: string;
}
```

Update `ChatMessage`:
```typescript
export interface ChatMessage {
  role: "user" | "assistant" | "exercise";
  text: string;
  timestamp: number;
  vocabHighlights?: VocabHighlight[];
  exercise?: ExerciseData;
  exerciseFeedback?: ExerciseFeedbackData;
}
```

**Step 2: Add exercise action type and case to `handleLessonEvent.ts`**

Add to `LessonAction` union:
```typescript
| { type: "show_exercise"; exercise: { exerciseId: string; type: string; pairs: Array<{ word: string; definition: string }> } }
```

Add case in switch before `default`:
```typescript
case "exercise": {
  const d = data as LessonEventData & { exerciseId?: string; type?: string; pairs?: Array<{ word: string; definition: string }> };
  if (d.exerciseId && d.type && d.pairs) {
    return { type: "show_exercise", exercise: { exerciseId: d.exerciseId, type: d.type, pairs: d.pairs } };
  }
  return { type: "discard" };
}
```

**Step 3: Commit**

Message: `feat(exercise): add frontend types and exercise event handling`

---

### Task 7: Handle exercise events in useLessonState

**Files:**
- Modify: `apps/web/src/hooks/useLessonState.ts`

**Step 1: Add exercise event handling**

In the `handleEvent` callback, add handlers for `exercise` and `exercise_feedback` events BEFORE the generic `handleLessonEvent` dispatch (similar to `vocab_highlight`):

```typescript
if (event === "exercise") {
  const d = data as LessonEventData & { exerciseId?: string; type?: string; pairs?: Array<{ word: string; definition: string }> };
  if (d.exerciseId && d.type && d.pairs) {
    setState((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          role: "exercise" as const,
          text: "",
          timestamp: Date.now(),
          exercise: { exerciseId: d.exerciseId!, type: d.type! as "matching", pairs: d.pairs! },
        },
      ],
    }));
  }
  return;
}

if (event === "exercise_feedback") {
  const d = data as LessonEventData & { exerciseId?: string; results?: Array<{ word: string; correct: boolean; correctDefinition: string }>; score?: string };
  if (d.exerciseId && d.results && d.score) {
    setState((prev) => {
      const messages = [...prev.messages];
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === "exercise" && messages[i]?.exercise?.exerciseId === d.exerciseId) {
          messages[i] = {
            ...messages[i]!,
            exerciseFeedback: { exerciseId: d.exerciseId!, results: d.results!, score: d.score! },
          };
          break;
        }
      }
      return { ...prev, messages };
    });
  }
  pendingTurnsRef.current = Math.max(0, pendingTurnsRef.current - 1);
  return;
}
```

**Step 2: Add submitExerciseAnswer to return object**

```typescript
submitExerciseAnswer: useCallback((exerciseId: string, answers: Array<{ word: string; definition: string }>) => {
  emit("exercise_answer", { exerciseId, answers });
}, [emit]),
```

**Step 3: Commit**

Message: `feat(exercise): handle exercise and exercise_feedback events in lesson state`

---

### Task 8: MatchingExercise component (frontend)

**Files:**
- Create: `apps/web/src/components/lesson/MatchingExercise.tsx`

**Step 1: Create the component**

Interactive matching UI with:
- Two columns: words (left), shuffled definitions (right)
- Click word then click definition to create a pair (color-coded)
- Reset button to clear matches
- Check button (enabled when all pairs matched)
- Compact view after feedback received (shows score badge)
- Tailwind styling consistent with existing lesson UI (glass morphism, white/opacity on dark gradient)

See design doc for full spec. Component accepts: `exercise: ExerciseData`, `feedback?: ExerciseFeedbackData`, `onSubmit` callback.

**Step 2: Commit**

Message: `feat(exercise): add MatchingExercise component`

---

### Task 9: Integrate MatchingExercise into ChatHistory and LessonScreen

**Files:**
- Modify: `apps/web/src/components/lesson/ChatHistory.tsx`
- Modify: `apps/web/src/components/lesson/LessonScreen.tsx`

**Step 1: Update ChatHistory**

1. Import `MatchingExercise` component
2. Add `onExerciseSubmit` prop to `ChatHistoryProps`
3. In messages map, add exercise rendering branch before user message check:
```tsx
{msg.role === "exercise" && msg.exercise ? (
  <MatchingExercise
    exercise={msg.exercise}
    feedback={msg.exerciseFeedback}
    onSubmit={onExerciseSubmit ?? (() => {})}
  />
) : msg.role === "user" ? (
  // existing user bubble
) : // existing assistant bubble
```

**Step 2: Update LessonScreen**

1. Destructure `submitExerciseAnswer` from `useLessonState`
2. Pass `onExerciseSubmit={submitExerciseAnswer}` to `ChatHistory`

**Step 3: Commit**

Message: `feat(exercise): integrate MatchingExercise into chat UI`

---

### Task 10: Lint, type-check, and full test run

**Step 1:** Run `pnpm lint` — fix any issues
**Step 2:** Run `pnpm type-check` — fix any type errors
**Step 3:** Run `pnpm --filter @jake/api test && pnpm --filter @jake/web test` — all pass
**Step 4:** Commit fixes if any

Message: `fix: lint and type-check fixes for exercise feature`
