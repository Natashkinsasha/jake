# Tutor Customization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded single tutor with customizable profiles based on gender + nationality. User selects gender, nationality, and voice — personality/style/slang/topics are derived from the gender+nationality combination.

**Architecture:** Constants-based tutor profiles on backend (no DB tables for tutors). User preferences store the selection. Prompt builder assembles system prompt from base instructions + profile fragment. Frontend modal for first-time selection, settings page for changes.

**Tech Stack:** NestJS, Drizzle ORM, PostgreSQL, Next.js, React, Tailwind CSS, Zod, ElevenLabs

---

### Task 1: Add tutor profile constants

**Files:**
- Create: `apps/api/src/@logic/tutor/domain/tutor-profiles.ts`
- Create: `apps/api/src/@logic/tutor/domain/tutor-voices.ts`
- Create: `apps/api/src/@logic/tutor/domain/tutor-types.ts`

**Step 1: Create type definitions**

Create `apps/api/src/@logic/tutor/domain/tutor-types.ts`:

```ts
export type TutorGender = "male" | "female";
export type TutorNationality = "australian" | "british" | "scottish" | "american";

export interface TutorProfile {
  gender: TutorGender;
  nationality: TutorNationality;
  description: string;
  traits: string[];
  promptFragment: string;
}

export interface TutorVoice {
  id: string;
  name: string;
  gender: TutorGender;
}
```

**Step 2: Create tutor profiles**

Create `apps/api/src/@logic/tutor/domain/tutor-profiles.ts`:

Write 8 unique profiles keyed by `${nationality}_${gender}`. Each profile has a unique `promptFragment` containing:
- `=== BACKGROUND ===` — unique biography
- `=== PERSONALITY ===` — unique character traits
- `=== LIKES ===` / `=== DISLIKES ===` — unique preferences
- `=== QUIRKS ===`
- `=== HOW TO USE YOUR PERSONALITY ===`

Use the current Jake seed prompt (`apps/api/src/seed.ts:5-71`) as the template for `australian_male`.

Profiles:
- `australian_male` — Laid-back surfer from Byron Bay (existing Jake personality)
- `australian_female` — Energetic outdoor-lover, grew up on Gold Coast, works as a surf instructor and private tutor
- `british_male` — Dry humor, grew up in Oxford, obsessed with tea, Premier League, and pub quizzes
- `british_female` — Warm and sarcastic, from Manchester, book lover, runs a book club, loves baking
- `scottish_male` — Rough but kind, from Edinburgh, whisky enthusiast, football fan, loves hiking the Highlands
- `scottish_female` — Sharp wit, from Glasgow, independent storyteller, into Celtic music and history
- `american_male` — Friendly optimist from San Diego, sporty (basketball, surfing), loves road trips
- `american_female` — Creative and positive, from Portland, tech-savvy, coffee culture, indie music

Export as:
```ts
export const TUTOR_PROFILES: Record<string, TutorProfile> = { ... };

export function getTutorProfile(nationality: TutorNationality, gender: TutorGender): TutorProfile {
  return TUTOR_PROFILES[`${nationality}_${gender}`];
}
```

**Step 3: Create voice list**

Create `apps/api/src/@logic/tutor/domain/tutor-voices.ts`:

```ts
import { TutorGender, TutorVoice } from "./tutor-types";

export const TUTOR_VOICES: TutorVoice[] = [
  // Male voices
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", gender: "male" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", gender: "male" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", gender: "male" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "male" },
  // Female voices
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "female" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", gender: "female" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Emily", gender: "female" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", gender: "female" },
];

export function getVoicesByGender(gender: TutorGender): TutorVoice[] {
  return TUTOR_VOICES.filter((v) => v.gender === gender);
}

export function getDefaultVoice(gender: TutorGender): TutorVoice {
  return TUTOR_VOICES.find((v) => v.gender === gender)!;
}
```

Note: Voice IDs above are placeholders — verify actual ElevenLabs voice IDs before deploying.

**Step 4: Commit**

```bash
git add apps/api/src/@logic/tutor/domain/tutor-types.ts apps/api/src/@logic/tutor/domain/tutor-profiles.ts apps/api/src/@logic/tutor/domain/tutor-voices.ts
git commit -m "feat(tutor): add tutor profile constants and voice definitions"
```

---

### Task 2: Add shared schemas for tutor customization

**Files:**
- Modify: `packages/shared/src/schemas/user.ts:1-33`

**Step 1: Add tutor enums and update UserPreferencesSchema**

Add to `packages/shared/src/schemas/user.ts`:

```ts
export const TutorGender = z.enum(["male", "female"]);
export const TutorNationality = z.enum(["australian", "british", "scottish", "american"]);
```

Add three fields to `UserPreferencesSchema`:

```ts
export const UserPreferencesSchema = z.object({
  // ... existing fields ...
  tutorGender: TutorGender.nullable().default(null),
  tutorNationality: TutorNationality.nullable().default(null),
  tutorVoiceId: z.string().nullable().default(null),
});
```

**Step 2: Commit**

```bash
git add packages/shared/src/schemas/user.ts
git commit -m "feat(shared): add tutor customization fields to UserPreferencesSchema"
```

---

### Task 3: Database migration — add tutor fields to user_preferences

**Files:**
- Modify: `apps/api/src/@logic/auth/infrastructure/table/user-preference.table.ts:1-17`
- Create: new migration file via `pnpm --filter @jake/api db:generate`

**Step 1: Add columns to user_preferences table**

Add to `user-preference.table.ts` (after line 15, before `updatedAt`):

```ts
tutorGender: varchar("tutor_gender", { length: 10 }),
tutorNationality: varchar("tutor_nationality", { length: 20 }),
tutorVoiceId: varchar("tutor_voice_id", { length: 255 }),
```

**Step 2: Generate migration**

Run: `pnpm --filter @jake/api db:generate`

This will create a new SQL migration in `apps/api/drizzle/`.

**Step 3: Apply migration**

Run: `pnpm db:migrate`

**Step 4: Commit**

```bash
git add apps/api/src/@logic/auth/infrastructure/table/user-preference.table.ts apps/api/drizzle/
git commit -m "feat(db): add tutor_gender, tutor_nationality, tutor_voice_id to user_preferences"
```

---

### Task 4: Database migration — remove tutorId FK from lessons, drop tutor tables

**Files:**
- Modify: `apps/api/src/@logic/lesson/infrastructure/table/lesson.table.ts:1-28`
- Create: new migration file

**Step 1: Remove tutorId from lesson table**

In `lesson.table.ts`, remove line 3 (import tutorTable) and line 10 (tutorId column):

```ts
// DELETE: import { tutorTable } from "../../../tutor/infrastructure/table/tutor.table";
// DELETE: tutorId: uuid("tutor_id").references(() => tutorTable.id).notNull(),
```

**Step 2: Generate migration**

Run: `pnpm --filter @jake/api db:generate`

Review the generated migration. It should:
- Drop `tutor_id` column from `lessons`
- Drop `user_tutors` table
- Drop `tutors` table

If drizzle doesn't auto-drop the tutor tables (since they're no longer referenced by any Drizzle schema), manually add to the migration SQL:

```sql
DROP TABLE IF EXISTS "user_tutors";
DROP TABLE IF EXISTS "tutors";
```

**Step 3: Apply migration**

Run: `pnpm db:migrate`

**Step 4: Commit**

```bash
git add apps/api/src/@logic/lesson/infrastructure/table/lesson.table.ts apps/api/drizzle/
git commit -m "feat(db): remove tutorId from lessons, drop tutors and user_tutors tables"
```

---

### Task 5: Refactor TutorModule — remove DB dependencies, expose constants

**Files:**
- Rewrite: `apps/api/src/@logic/tutor/tutor.module.ts`
- Create: `apps/api/src/@logic/tutor/application/service/tutor.service.ts`
- Rewrite: `apps/api/src/@logic/tutor/contract/tutor.contract.ts`
- Rewrite: `apps/api/src/@logic/tutor/presentation/controller/tutor.controller.ts`
- Delete: `apps/api/src/@logic/tutor/infrastructure/repository/tutor.repository.ts`
- Delete: `apps/api/src/@logic/tutor/infrastructure/repository/user-tutor.repository.ts`
- Delete: `apps/api/src/@logic/tutor/infrastructure/table/tutor.table.ts`
- Delete: `apps/api/src/@logic/tutor/infrastructure/table/user-tutor.table.ts`
- Delete: `apps/api/src/@logic/tutor/infrastructure/factory/tutor.factory.ts`
- Delete: `apps/api/src/@logic/tutor/infrastructure/factory/user-tutor.factory.ts`
- Delete: `apps/api/src/@logic/tutor/domain/entity/tutor.entity.ts`
- Delete: `apps/api/src/@logic/tutor/domain/entity/user-tutor.entity.ts`
- Delete: `apps/api/src/@logic/tutor/application/maintainer/tutor.maintainer.ts`
- Delete: `apps/api/src/@logic/tutor/application/mapper/tutor.mapper.ts`
- Delete: `apps/api/src/@logic/tutor/presentation/dto/response/tutor-list.response.ts`

**Step 1: Create TutorService**

Create `apps/api/src/@logic/tutor/application/service/tutor.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { TUTOR_PROFILES } from "../../domain/tutor-profiles";
import { getVoicesByGender, getDefaultVoice } from "../../domain/tutor-voices";
import { getTutorProfile } from "../../domain/tutor-profiles";
import type { TutorGender, TutorNationality, TutorProfile, TutorVoice } from "../../domain/tutor-types";

@Injectable()
export class TutorService {
  getProfiles(): TutorProfile[] {
    return Object.values(TUTOR_PROFILES);
  }

  getProfile(nationality: TutorNationality, gender: TutorGender): TutorProfile {
    return getTutorProfile(nationality, gender);
  }

  getVoices(gender: TutorGender): TutorVoice[] {
    return getVoicesByGender(gender);
  }

  getDefaultVoiceId(gender: TutorGender): string {
    return getDefaultVoice(gender).id;
  }
}
```

**Step 2: Rewrite TutorContract**

Rewrite `apps/api/src/@logic/tutor/contract/tutor.contract.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { TutorService } from "../application/service/tutor.service";
import type { TutorGender, TutorNationality, TutorProfile, TutorVoice } from "../domain/tutor-types";

@Injectable()
export class TutorContract {
  constructor(private readonly tutorService: TutorService) {}

  getProfiles(): TutorProfile[] {
    return this.tutorService.getProfiles();
  }

  getProfile(nationality: TutorNationality, gender: TutorGender): TutorProfile {
    return this.tutorService.getProfile(nationality, gender);
  }

  getVoices(gender: TutorGender): TutorVoice[] {
    return this.tutorService.getVoices(gender);
  }

  getDefaultVoiceId(gender: TutorGender): string {
    return this.tutorService.getDefaultVoiceId(gender);
  }
}
```

**Step 3: Rewrite TutorController**

Rewrite `apps/api/src/@logic/tutor/presentation/controller/tutor.controller.ts`:

```ts
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "@shared/shared-auth/jwt-auth.guard";
import { TutorContract } from "../../contract/tutor.contract";
import type { TutorGender } from "../../domain/tutor-types";

@Controller("tutor")
@UseGuards(JwtAuthGuard)
export class TutorController {
  constructor(private readonly tutorContract: TutorContract) {}

  @Get("profiles")
  getProfiles() {
    return this.tutorContract.getProfiles().map((p) => ({
      gender: p.gender,
      nationality: p.nationality,
      description: p.description,
      traits: p.traits,
    }));
  }

  @Get("voices")
  getVoices(@Query("gender") gender: TutorGender) {
    return this.tutorContract.getVoices(gender);
  }
}
```

**Step 4: Rewrite TutorModule**

Rewrite `apps/api/src/@logic/tutor/tutor.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { SharedAuthModule } from "@shared/shared-auth/shared-auth.module";
import { TutorController } from "./presentation/controller/tutor.controller";
import { TutorService } from "./application/service/tutor.service";
import { TutorContract } from "./contract/tutor.contract";

@Module({
  imports: [SharedAuthModule],
  controllers: [TutorController],
  providers: [TutorService, TutorContract],
  exports: [TutorContract],
})
export class TutorModule {}
```

**Step 5: Delete old files**

Delete all files listed in the "Delete" section above — repositories, tables, factories, entities, maintainer, mapper, DTO.

**Step 6: Commit**

```bash
git add -A apps/api/src/@logic/tutor/
git commit -m "refactor(tutor): replace DB-based tutor with constants-based profiles"
```

---

### Task 6: Remove tutor auto-assignment from AuthMaintainer

**Files:**
- Modify: `apps/api/src/@logic/auth/application/maintainer/auth.maintainer.ts:1-55`
- Modify: `apps/api/src/@logic/auth/auth.module.ts:1-17`

**Step 1: Remove TutorContract from AuthMaintainer**

In `auth.maintainer.ts`:
- Remove import of `TutorContract` (line 4)
- Remove `private tutorContract: TutorContract` from constructor (line 13)
- Remove tutor auto-assignment block (lines 28-36)

**Step 2: Remove TutorModule import from AuthModule**

In `auth.module.ts`:
- Remove `import { TutorModule }` (line 4)
- Remove `TutorModule` from `imports` array (line 12)

**Step 3: Update updatePreferences to accept new fields**

In `auth.maintainer.ts`, the `updatePreferences` method already passes through to `UserRepository.updatePreferences`. No changes needed here.

In `user.repository.ts:56-66`, add new fields to the `Partial<>` type:

```ts
async updatePreferences(userId: string, data: Partial<{
  correctionStyle: string;
  explainGrammar: boolean;
  speakingSpeed: string;
  useNativeLanguage: boolean;
  preferredExerciseTypes: string[];
  interests: string[];
  ttsModel: string;
  tutorGender: string;
  tutorNationality: string;
  tutorVoiceId: string;
}>): Promise<void> {
```

In `update-preferences.body.ts`, add:

```ts
tutorGender: z.enum(["male", "female"]).optional(),
tutorNationality: z.enum(["australian", "british", "scottish", "american"]).optional(),
tutorVoiceId: z.string().optional(),
```

**Step 4: Commit**

```bash
git add apps/api/src/@logic/auth/
git commit -m "refactor(auth): remove tutor auto-assignment, add tutor preference fields"
```

---

### Task 7: Refactor LessonContextService and PromptBuilder

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/service/lesson-context.service.ts:1-96`
- Modify: `apps/api/src/@logic/lesson/application/dto/lesson-context.ts:1-26`
- Modify: `apps/api/src/@logic/lesson/application/service/prompt-builder.ts:1-135`
- Modify: `apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts:106-113`
- Modify: `apps/api/src/@logic/lesson/lesson.module.ts:11,43`

**Step 1: Update LessonContext DTO**

In `lesson-context.ts`, replace tutor fields:

```ts
export interface LessonContext {
  studentName: string;
  level: string | null;
  lessonNumber: number;
  lastLessonAt: Date | null;
  tutorPromptFragment: string;  // was: tutorSystemPrompt
  tutorVoiceId: string;         // same
  // REMOVED: tutorId
  preferences: {
    correctionStyle: string;
    speakingSpeed: string;
    useNativeLanguage: boolean;
    explainGrammar: boolean;
    preferredExercises: string[];
    interests: string[];
    ttsModel: string;
  };
  facts: Array<{ category: string; fact: string }>;
  recentEmotionalContext: string[];
  learningFocus: {
    weakAreas: string[];
    strongAreas: string[];
    recentWords: string[];
    suggestedTopics: string[];
  };
}
```

**Step 2: Update LessonContextService**

In `lesson-context.service.ts`:
- Remove `TutorContract` import and constructor injection (lines 7, 18)
- Add import: `import { getTutorProfile } from "../../../tutor/domain/tutor-profiles";`
- Add import: `import { getDefaultVoice } from "../../../tutor/domain/tutor-voices";`
- Add import: `import type { TutorGender, TutorNationality } from "../../../tutor/domain/tutor-types";`
- Remove `this.tutorContract.findActiveUserTutor(userId)` from Promise.all (line 33)
- Remove `activeTutor` from destructuring (line 26)
- Remove `if (!user || !activeTutor)` check (line 38) — replace with `if (!user)`
- Build tutor from preferences:

```ts
const gender = (prefs?.tutorGender ?? "male") as TutorGender;
const nationality = (prefs?.tutorNationality ?? "australian") as TutorNationality;
const voiceId = prefs?.tutorVoiceId ?? getDefaultVoice(gender).id;
const profile = getTutorProfile(nationality, gender);
```

- Replace context fields:
```ts
tutorPromptFragment: profile.promptFragment,
tutorVoiceId: voiceId,
// REMOVE: tutorId
```

**Step 3: Update PromptBuilder**

In `prompt-builder.ts`:
- Line 72: change `JAKE_BASE_PROMPT` — remove "Australian" from the prompt text, make it generic:

```ts
const BASE_PROMPT = `You are Jake, a friendly English tutor in your late 20s.
...rest stays the same but remove "Australian" reference...`;
```

- Line 74: change `context.tutorSystemPrompt` to `context.tutorPromptFragment`

**Step 4: Update LessonMaintainer**

In `lesson.maintainer.ts`:
- Line 109: Remove `tutorId: context.tutorId` from `createWithGreeting` call. Since `tutorId` column was removed from lesson table (Task 4), this field is no longer needed.

**Step 5: Remove TutorModule from LessonModule imports**

In `lesson.module.ts`:
- Remove `import { TutorModule }` (line 11)
- Remove `TutorModule` from `imports` array (line 43)

**Step 6: Update prompt-builder test**

In `apps/api/src/@logic/lesson/application/service/prompt-builder.spec.ts`:
- Remove `tutorId` from test fixture
- Rename `tutorSystemPrompt` to `tutorPromptFragment`

**Step 7: Update evals fixtures**

In `evals/fixtures/lesson-contexts.ts`:
- Remove `tutorId` field
- Rename `tutorSystemPrompt` to `tutorPromptFragment`

**Step 8: Commit**

```bash
git add apps/api/src/@logic/lesson/ evals/
git commit -m "refactor(lesson): use tutor profile constants instead of DB tutor"
```

---

### Task 8: Delete seed.ts tutor logic

**Files:**
- Modify: `apps/api/src/seed.ts:1-107`

**Step 1: Remove or simplify seed.ts**

The entire seed.ts was only for seeding the Jake tutor. Since tutors are now constants, this file can be emptied or removed. If there's a `db:seed` script in package.json that references it, update accordingly.

Replace contents with:

```ts
console.log("No seeding required — tutor profiles are now constants.");
```

Or delete the file entirely and remove the `db:seed` script from `apps/api/package.json`.

**Step 2: Commit**

```bash
git add apps/api/src/seed.ts
git commit -m "chore: remove tutor seeding (profiles are now constants)"
```

---

### Task 9: Update shared schemas and web types

**Files:**
- Modify: `packages/shared/src/schemas/lesson.ts:15` — remove `tutorId`
- Modify: `apps/web/src/types/index.ts:14-20` — add tutor fields to `UserPreferences`

**Step 1: Remove tutorId from lesson schema**

In `packages/shared/src/schemas/lesson.ts`, remove the `tutorId` field.

**Step 2: Add tutor fields to web UserPreferences type**

In `apps/web/src/types/index.ts`:

```ts
export interface UserPreferences {
  correctionStyle?: string;
  explainGrammar?: boolean;
  useNativeLanguage?: boolean;
  speakingSpeed?: string;
  ttsModel?: string;
  tutorGender?: string | null;
  tutorNationality?: string | null;
  tutorVoiceId?: string | null;
}
```

**Step 3: Commit**

```bash
git add packages/shared/ apps/web/src/types/
git commit -m "feat(shared): update schemas for tutor customization"
```

---

### Task 10: Update web API client

**Files:**
- Modify: `apps/web/src/lib/api.ts:36-74`

**Step 1: Replace tutors API with new endpoints**

Replace the `tutors` section:

```ts
tutor: {
  profiles: () =>
    request<{ gender: string; nationality: string; description: string; traits: string[] }[]>("/tutor/profiles"),
  voices: (gender: string) =>
    request<{ id: string; name: string; gender: string }[]>(`/tutor/voices?gender=${gender}`),
},
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): update API client for tutor customization endpoints"
```

---

### Task 11: Create TutorSetupModal component

**Files:**
- Create: `apps/web/src/components/TutorSetupModal.tsx`

**Step 1: Build the modal component**

Create a modal with 3 steps:

1. **Gender selection** — two cards (Male / Female)
2. **Nationality selection** — four cards (Australian / British / Scottish / American) with description from profile
3. **Voice selection** — list of voices filtered by selected gender, with play preview button (optional, can be added later)

Props:
```ts
interface TutorSetupModalProps {
  open: boolean;
  onComplete: (selection: { tutorGender: string; tutorNationality: string; tutorVoiceId: string }) => void;
}
```

The component:
- Fetches profiles via `api.tutor.profiles()` on mount
- Fetches voices via `api.tutor.voices(gender)` when gender is selected
- Has "Back" and "Next" buttons for navigation
- On final step, calls `api.auth.updatePreferences(selection)` then `onComplete(selection)`
- Uses Tailwind styling consistent with existing dashboard UI (rounded-2xl, gradients, animations)

**Step 2: Commit**

```bash
git add apps/web/src/components/TutorSetupModal.tsx
git commit -m "feat(web): add TutorSetupModal component"
```

---

### Task 12: Integrate modal into dashboard

**Files:**
- Modify: `apps/web/src/app/(app)/dashboard/page.tsx:1-184`

**Step 1: Add tutor setup check**

- Import `TutorSetupModal`
- Fetch user preferences on mount (already available via `useBackendSession`)
- Add state: `const [showTutorSetup, setShowTutorSetup] = useState(false)`
- On "Start a conversation" button click: check if `user_preferences.tutorGender` is null. If so, show modal instead of navigating to `/lesson`.

```ts
const handleStartLesson = () => {
  const prefs = user?.preferences; // or however preferences are accessed
  if (!prefs?.tutorGender) {
    setShowTutorSetup(true);
  } else {
    router.push("/lesson");
  }
};
```

- On modal complete: navigate to `/lesson`

**Step 2: Update static text**

Change "Start a conversation with Jake" to "Start a conversation" (Jake name doesn't need to be in the CTA since all tutors are Jake).

Actually keep "Practice your English with Jake" — it's still Jake regardless of customization.

**Step 3: Commit**

```bash
git add apps/web/src/app/(app)/dashboard/page.tsx
git commit -m "feat(web): integrate TutorSetupModal into dashboard"
```

---

### Task 13: Create settings page with tutor section

**Files:**
- Create: `apps/web/src/app/(app)/settings/page.tsx`

**Step 1: Build settings page**

Create a settings page with a "Tutor" section showing:
- Current gender (selectable)
- Current nationality (selectable)
- Current voice (selectable, filtered by gender)
- Save button

Fetch current preferences via `api.auth.me()`, update via `api.auth.updatePreferences()`.

Add navigation link to settings from dashboard (e.g., gear icon in the header).

**Step 2: Commit**

```bash
git add apps/web/src/app/(app)/settings/
git commit -m "feat(web): add settings page with tutor customization"
```

---

### Task 14: Verify and clean up

**Step 1: Run type-check**

Run: `pnpm type-check`
Expected: No errors

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 3: Run API tests**

Run: `pnpm --filter @jake/api test`
Expected: All pass (some may need updates for removed tutorId)

**Step 4: Run web tests**

Run: `pnpm --filter @jake/web test`
Expected: All pass

**Step 5: Manual smoke test**

1. Start dev servers: `pnpm dev`
2. Open dashboard — click "Start a conversation"
3. Modal should appear (first time)
4. Select gender → nationality → voice → confirm
5. Lesson should start with correct voice and personality
6. Go to settings, change nationality
7. Start new lesson — should reflect new personality

**Step 6: Clean up CLAUDE.md and README references**

- Update `apps/api/src/seed.ts` references
- Remove `tutors`, `user_tutors` from DB table docs
- Update tutor module description

**Step 7: Final commit**

```bash
git add -A
git commit -m "chore: clean up references to old tutor system"
```
