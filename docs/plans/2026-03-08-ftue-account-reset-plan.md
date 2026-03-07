# FTUE + Account Reset Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add onboarding mode for new users (tutor assesses level through conversation) and account reset button in settings.

**Architecture:** Onboarding flag on user record controls system prompt mode. During onboarding, tutor uses simple language, forced very_slow speed, and returns structured `<onboarding>` tags. Post-lesson job checks for level assessment. Account reset deletes all user data except the user record itself.

**Tech Stack:** NestJS, Drizzle ORM, Socket.IO, React/Next.js, Tailwind CSS

---

### Task 1: Extend LessonContext with onboarding flag

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/dto/lesson-context.ts:1-25`
- Modify: `apps/api/src/@logic/lesson/application/service/lesson-context.service.ts:72-101`

**Step 1: Add `onboardingCompleted` to LessonContext interface**

In `lesson-context.ts`, add field after `level`:

```typescript
export interface LessonContext {
  studentName: string;
  level: string | null;
  onboardingCompleted: boolean;
  lessonNumber: number;
  // ... rest unchanged
}
```

**Step 2: Pass `onboardingCompleted` from user record in context service**

In `lesson-context.service.ts` line 72, add to the return object:

```typescript
return {
  studentName: user.users.name,
  level: user.users.currentLevel,
  onboardingCompleted: user.users.onboardingCompleted ?? false,
  lessonNumber: lessonCount + 1,
  // ... rest unchanged
};
```

**Step 3: Commit**

```bash
git add apps/api/src/@logic/lesson/application/dto/lesson-context.ts apps/api/src/@logic/lesson/application/service/lesson-context.service.ts
git commit -m "feat(lesson): add onboardingCompleted to LessonContext"
```

---

### Task 2: Add ONBOARDING MODE to system prompt

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/service/prompt-builder.ts:95-159`
- Modify: `apps/api/src/@logic/lesson/application/service/prompt-builder.spec.ts`

**Step 1: Write failing tests**

Add to `prompt-builder.spec.ts`:

```typescript
it("should include onboarding mode when onboardingCompleted is false", () => {
  const result = buildFullSystemPrompt(createMockContext({ onboardingCompleted: false }));
  expect(result).toContain("=== ONBOARDING MODE ===");
  expect(result).toContain("very_slow");
  expect(result).toContain("<onboarding>");
});

it("should not include onboarding mode when onboardingCompleted is true", () => {
  const result = buildFullSystemPrompt(createMockContext({ onboardingCompleted: true }));
  expect(result).not.toContain("=== ONBOARDING MODE ===");
});
```

Update `createMockContext` to include `onboardingCompleted: true` by default.

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @jake/api test -- --testPathPattern=prompt-builder`

**Step 3: Add ONBOARDING MODE block to prompt builder**

Replace the existing FIRST LESSON INSTRUCTIONS block (lines 148-156) with onboarding-aware logic:

```typescript
if (!context.onboardingCompleted) {
  parts.push(`\n=== ONBOARDING MODE ===
You are meeting this student for the first time (or haven't finished getting to know them yet).

COMMUNICATION STYLE:
- Speak VERY simply — short sentences, basic vocabulary (A1-level)
- Use the student's native language if they seem completely lost
- Speech speed MUST stay at very_slow — do NOT increase it during onboarding
- Be warm, patient, and encouraging

YOUR GOALS:
1. Make them feel comfortable — this is a friendly chat, not a test
2. Ask about their experience with English naturally:
   - How often do they use English? (work, daily life, rarely)
   - When was the last time they used it?
   - In what context? (travel, work, movies, etc.)
3. Assess their level by HOW they respond — grammar, vocabulary, fluency
4. Focus on getting to know them, minimal exercises (but simple tasks to gauge level are ok)
5. Don't overwhelm — keep it light and short

WHEN YOU ARE CONFIDENT ABOUT THEIR LEVEL:
Include this tag at the END of your response (after all spoken text, after <set_speed> if any):
<onboarding status="complete" level="A1|A2|B1|B2|C1|C2"/>

Until you are confident, include:
<onboarding status="in_progress"/>

IMPORTANT: Take your time. It's OK if this takes multiple lessons. Don't rush the assessment.`);
} else if (context.lessonNumber === 1) {
  parts.push(`\n=== FIRST LESSON INSTRUCTIONS ===
This is the student's FIRST lesson. Your goals:
1. Make them feel comfortable and excited
2. Learn about them naturally through conversation
3. Assess their level without formal testing
4. Keep it short and fun (10-15 min max)
5. Don't overwhelm with exercises`);
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @jake/api test -- --testPathPattern=prompt-builder`

**Step 5: Commit**

```bash
git add apps/api/src/@logic/lesson/application/service/prompt-builder.ts apps/api/src/@logic/lesson/application/service/prompt-builder.spec.ts
git commit -m "feat(lesson): add ONBOARDING MODE to system prompt"
```

---

### Task 3: Parse onboarding tags and update user in lesson flow

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts`
- Modify: `apps/api/src/@logic/lesson/application/service/lesson-session.service.ts`
- Modify: `apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts`
- Modify: `apps/api/src/@logic/auth/contract/auth.contract.ts`
- Modify: `apps/api/src/@logic/auth/infrastructure/repository/user.repository.ts`

**Step 1: Add `completeOnboarding` to AuthContract and UserRepository**

In `user.repository.ts` after line 54, add:

```typescript
async completeOnboarding(id: string, level: string): Promise<void> {
  await this.txHost.tx
    .update(userTable)
    .set({ onboardingCompleted: true, currentLevel: level, updatedAt: new Date() })
    .where(eq(userTable.id, id));
}
```

In `auth.contract.ts` add:

```typescript
async completeOnboarding(userId: string, level: string): Promise<void> {
  return this.userRepository.completeOnboarding(userId, level);
}
```

**Step 2: Add `isOnboarding` to LessonSession interface**

In `lesson-session.service.ts` line 6:

```typescript
export interface LessonSession {
  lessonId: string;
  systemPrompt: string;
  voiceId: string;
  speechSpeed: number;
  history: LlmMessage[];
  voiceMismatch?: boolean;
  isOnboarding?: boolean;
}
```

**Step 3: Add onboarding tag parsing to lesson maintainer**

In `lesson.maintainer.ts`, add regex and parser at the top (after SET_SPEED_RE):

```typescript
const ONBOARDING_RE = /<onboarding\s+status="(complete|in_progress)"(?:\s+level="(A1|A2|B1|B2|C1|C2)")?\s*\/>/g;

function stripOnboardingTags(text: string): { cleanText: string; onboardingComplete: boolean; level: string | null } {
  let onboardingComplete = false;
  let level: string | null = null;
  const cleanText = text.replaceAll(ONBOARDING_RE, (_, status: string, lvl: string | undefined) => {
    if (status === "complete" && lvl) {
      onboardingComplete = true;
      level = lvl;
    }
    return "";
  }).trim();
  return { cleanText, onboardingComplete, level };
}
```

**Step 4: Inject AuthContract into LessonMaintainer constructor**

Add to constructor:

```typescript
import { AuthContract } from "../../../auth/contract/auth.contract";

constructor(
  // ... existing deps
  private authContract: AuthContract,
) {}
```

**Step 5: Update `startLesson` to set isOnboarding and force speed**

In `startLesson()`, after building context (line 97), before building system prompt:

```typescript
const isOnboarding = !context.onboardingCompleted;

// Force very_slow during onboarding
if (isOnboarding) {
  context.preferences.speakingSpeed = "very_slow";
}
```

Add `isOnboarding` to the return object:

```typescript
return {
  lessonId: lesson.id,
  systemPrompt,
  voiceId: context.tutorVoiceId,
  speechSpeed,
  ttsModel: context.preferences.ttsModel,
  greeting: { text: greetingCleanText, emotion: greetingEmotion },
  isOnboarding,
};
```

**Step 6: Parse onboarding tags in `processTextMessageStreaming`**

In the `onEnd` callback (inside the async IIFE, after `stripSpeedTags` and `parseEmotion` on lines 190-191), add:

```typescript
const { cleanText: textWithoutOnboarding, onboardingComplete, level } = stripOnboardingTags(cleanText);

if (onboardingComplete && level) {
  await this.authContract.completeOnboarding(userId, level);
  callbacks.onOnboardingComplete?.({ level });
}
```

Use `textWithoutOnboarding` instead of `cleanText` for the rest of the callback (message save, history append, onEnd emit).

**Step 7: Add `onOnboardingComplete` to StreamCallbacks**

In `streaming-pipeline.service.ts`, extend StreamCallbacks:

```typescript
onOnboardingComplete?: (data: { level: string }) => void;
```

**Step 8: Update gateway to save `isOnboarding` in session and emit events**

In `lesson.gateway.ts` `handleConnection`, save isOnboarding to session (line 80):

```typescript
await this.sessionService.save(client.id, {
  lessonId: result.lessonId,
  systemPrompt: result.systemPrompt,
  voiceId: result.voiceId,
  speechSpeed: result.speechSpeed,
  history: [{ role: "assistant", content: result.greeting.text }],
  isOnboarding: result.isOnboarding,
});
```

Add `isOnboarding` to `lesson_started` event (line 88):

```typescript
client.emit("lesson_started", {
  lessonId: result.lessonId,
  voiceId: result.voiceId,
  speechSpeed: result.speechSpeed,
  ttsModel: result.ttsModel,
  systemPrompt: result.systemPrompt,
  emotion: result.greeting.emotion,
  isOnboarding: result.isOnboarding,
});
```

Add `onOnboardingComplete` callback in `handleText` (after `onEmotion` around line 183):

```typescript
onOnboardingComplete: (data) => {
  client.emit("onboarding_completed", data);
},
```

**Step 9: Commit**

```bash
git add apps/api/src/@logic/lesson/ apps/api/src/@logic/auth/
git commit -m "feat(lesson): parse onboarding tags and complete onboarding in real-time"
```

---

### Task 4: Strip onboarding tags from greeting too

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts:101-106`

**Step 1: Apply `stripOnboardingTags` to greeting text**

In `startLesson()`, after `stripSpeedTags` and `parseEmotion` (lines 105-106):

```typescript
const { cleanText: greetingText, speed: greetingSpeed } = stripSpeedTags(greeting.text);
const { emotion: greetingEmotion, text: greetingTextNoEmotion } = parseEmotion(greetingText);
const { cleanText: greetingCleanText } = stripOnboardingTags(greetingTextNoEmotion);
```

Use `greetingCleanText` for the lesson creation and return.

**Step 2: Commit**

```bash
git add apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts
git commit -m "fix(lesson): strip onboarding tags from greeting"
```

---

### Task 5: Account reset — backend

**Files:**
- Modify: `apps/api/src/@logic/auth/infrastructure/repository/user.repository.ts`
- Modify: `apps/api/src/@logic/auth/application/maintainer/auth.maintainer.ts`
- Modify: `apps/api/src/@logic/auth/presentation/controller/auth.controller.ts`
- Modify: `apps/api/src/@logic/auth/contract/auth.contract.ts`

**Step 1: Add `resetAccount` to UserRepository**

Since all related tables have `onDelete: "cascade"` on userId FK, we can delete data by userId from each table directly. We DON'T delete the user — we reset their data.

```typescript
async resetAccount(id: string): Promise<void> {
  // Delete all related data (lesson_messages cascade from lessons)
  await this.txHost.tx.delete(lessonTable).where(eq(lessonTable.userId, id));
  await this.txHost.tx.delete(memoryFactTable).where(eq(memoryFactTable.userId, id));
  await this.txHost.tx.delete(memoryEmbeddingTable).where(eq(memoryEmbeddingTable.userId, id));
  await this.txHost.tx.delete(vocabularyTable).where(eq(vocabularyTable.userId, id));
  await this.txHost.tx.delete(grammarProgressTable).where(eq(grammarProgressTable.userId, id));

  // Reset user fields
  await this.txHost.tx.update(userTable).set({
    currentLevel: null,
    onboardingCompleted: false,
    updatedAt: new Date(),
  }).where(eq(userTable.id, id));

  // Reset preferences to defaults
  await this.txHost.tx.update(userPreferenceTable).set({
    correctionStyle: "immediate",
    explainGrammar: true,
    speakingSpeed: "very_slow",
    useNativeLanguage: false,
    preferredExerciseTypes: [],
    interests: [],
    tutorGender: null,
    tutorNationality: null,
    tutorVoiceId: null,
    updatedAt: new Date(),
  }).where(eq(userPreferenceTable.userId, id));
}
```

Note: Import the needed table schemas. Since UserRepository currently only imports user-related tables, you'll need to import the others. Alternatively, create a dedicated `ResetService` that uses contracts. The simpler approach is to add delete methods to each contract and orchestrate in the maintainer.

**Better approach — use contracts in AuthMaintainer:**

Add `deleteByUser` methods to contracts:

In `vocabulary.contract.ts`:
```typescript
async deleteByUser(userId: string): Promise<void> {
  return this.vocabularyRepository.deleteByUser(userId);
}
```

In `progress.contract.ts`:
```typescript
async deleteByUser(userId: string): Promise<void> {
  return this.grammarProgressRepository.deleteByUser(userId);
}
```

In `memory.contract.ts`:
```typescript
async deleteByUser(userId: string): Promise<void> {
  // delete both facts and embeddings
  await this.memoryFactRepository.deleteByUser(userId);
  await this.memoryEmbeddingRepository.deleteByUser(userId);
}
```

Add `deleteByUser` to each repository (simple `DELETE FROM table WHERE userId = $1`).

Add `deleteByUser` to a new `LessonContract` or use `LessonRepository` directly.

In `auth.maintainer.ts`:
```typescript
async resetAccount(userId: string): Promise<void> {
  await this.lessonContract.deleteByUser(userId);
  await this.memoryContract.deleteByUser(userId);
  await this.vocabularyContract.deleteByUser(userId);
  await this.progressContract.deleteByUser(userId);
  await this.userRepository.resetUserFields(userId);
}
```

**Step 2: Add endpoint to AuthController**

```typescript
@Post("me/reset")
@UseGuards(JwtAuthGuard)
async resetAccount(@CurrentUserId() userId: string) {
  await this.authMaintainer.resetAccount(userId);
  return { success: true };
}
```

**Step 3: Commit**

```bash
git add apps/api/src/@logic/
git commit -m "feat(auth): add account reset endpoint"
```

---

### Task 6: Account reset — frontend

**Files:**
- Modify: `apps/web/src/lib/api.ts:36-76`
- Modify: `apps/web/src/components/settings/SettingsDrawer.tsx`

**Step 1: Add `resetAccount` to API client**

In `api.ts`, add to `auth` object:

```typescript
resetAccount: () =>
  request<{ success: boolean }>("/auth/me/reset", {
    method: "POST",
  }),
```

**Step 2: Add reset button to SettingsDrawer**

Add state for confirmation dialog:

```typescript
const [showResetConfirm, setShowResetConfirm] = useState(false);
const [resetting, setResetting] = useState(false);

const handleReset = useCallback(async () => {
  setResetting(true);
  try {
    await api.auth.resetAccount();
    setShowResetConfirm(false);
    onClose();
    window.location.reload();
  } catch {
    setResetting(false);
  }
}, [onClose]);
```

Add section after the Lesson section (before closing `</div>` of `p-4 space-y-6`):

```tsx
<section>
  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Account</h3>
  <button
    type="button"
    onClick={() => setShowResetConfirm(true)}
    className="w-full px-3 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
  >
    Reset Account
  </button>
</section>

{showResetConfirm && (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-xl p-6 w-80 shadow-2xl">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Reset Account?</h3>
      <p className="text-sm text-gray-500 mb-4">
        All lessons, progress, vocabulary, and memory will be permanently deleted. Your settings will be reset to defaults.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowResetConfirm(false)}
          className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          disabled={resetting}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleReset()}
          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          disabled={resetting}
        >
          {resetting ? "Resetting..." : "Reset"}
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/components/settings/SettingsDrawer.tsx
git commit -m "feat(web): add account reset button to settings"
```

---

### Task 7: Type-check and lint

**Step 1: Run type-check**

```bash
pnpm type-check
```

**Step 2: Run lint**

```bash
pnpm lint
```

**Step 3: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: resolve lint and type-check issues"
```
