# Settings Drawer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a settings drawer with all user preferences (TTS model, speaking speed, correction style, grammar, native language) and auto-save.

**Architecture:** Add `ttsModel` column to DB, pass it through `lesson_started` WS event to frontend, build a slide-out drawer component triggered from the app header, auto-save each change via `PUT /auth/me/preferences`.

**Tech Stack:** NestJS, Drizzle ORM, Next.js, React, Tailwind CSS, Socket.IO

---

### Task 1: Add `ttsModel` column to DB

**Files:**
- Modify: `apps/api/src/@logic/auth/infrastructure/table/user-preference.table.ts:6-16`
- Create: `apps/api/drizzle/0004_add_tts_model.sql`

**Step 1: Add column to Drizzle table definition**

In `user-preference.table.ts`, add after `useNativeLanguage` (line 12):

```typescript
ttsModel: varchar("tts_model", { length: 50 }).default("eleven_turbo_v2_5"),
```

**Step 2: Create SQL migration**

Create `apps/api/drizzle/0004_add_tts_model.sql`:

```sql
ALTER TABLE "user_preferences"
  ADD COLUMN "tts_model" VARCHAR(50) DEFAULT 'eleven_turbo_v2_5';
```

**Step 3: Run migration locally**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm db:migrate`
Expected: Migration applies successfully

**Step 4: Verify build**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/api type-check`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/@logic/auth/infrastructure/table/user-preference.table.ts apps/api/drizzle/0004_add_tts_model.sql
git commit -m "feat: add ttsModel column to user_preferences"
```

---

### Task 2: Update backend DTOs and preferences flow

**Files:**
- Modify: `apps/api/src/@logic/auth/presentation/dto/body/update-preferences.body.ts:4-11`
- Modify: `apps/api/src/@logic/auth/infrastructure/repository/user.repository.ts:56-65`

**Step 1: Add `ttsModel` to Zod schema**

In `update-preferences.body.ts`, add to the schema object (after line 8):

```typescript
ttsModel: z.string().optional(),
```

**Step 2: Add `ttsModel` to `updatePreferences` type**

In `user.repository.ts`, add to the `data` parameter type (line 56-63), after `interests`:

```typescript
ttsModel: string;
```

**Step 3: Verify build**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/api type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/api/src/@logic/auth/presentation/dto/body/update-preferences.body.ts apps/api/src/@logic/auth/infrastructure/repository/user.repository.ts
git commit -m "feat: add ttsModel to preferences DTO and repository"
```

---

### Task 3: Pass `ttsModel` through lesson start flow

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/service/lesson-context.service.ts:72-79`
- Modify: `apps/api/src/@logic/lesson/application/dto/lesson-context.ts:9-16`
- Modify: `apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts:95-121`
- Modify: `apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts:80-84`

**Step 1: Add `ttsModel` to `LessonContext` preferences**

In `lesson-context.ts`, add to the `preferences` interface (after `interests`, line 16):

```typescript
ttsModel: string;
```

**Step 2: Pass `ttsModel` in `LessonContextService.build()`**

In `lesson-context.service.ts`, add to the preferences object (after line 78):

```typescript
ttsModel: prefs?.ttsModel ?? "eleven_turbo_v2_5",
```

**Step 3: Return `ttsModel` from `LessonMaintainer.startLesson()`**

In `lesson.maintainer.ts`, add `ttsModel` to the return object (after `speechSpeed`, line 119):

```typescript
ttsModel: context.preferences.ttsModel,
```

**Step 4: Include `ttsModel` in `lesson_started` event**

In `lesson.gateway.ts`, add to the `lesson_started` emit (line 80-84):

Change:
```typescript
client.emit("lesson_started", {
  lessonId: result.lessonId,
  voiceId: result.voiceId,
  speechSpeed: result.speechSpeed,
});
```

To:
```typescript
client.emit("lesson_started", {
  lessonId: result.lessonId,
  voiceId: result.voiceId,
  speechSpeed: result.speechSpeed,
  ttsModel: result.ttsModel,
});
```

**Step 5: Verify build**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/api type-check`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/api/src/@logic/lesson/application/dto/lesson-context.ts apps/api/src/@logic/lesson/application/service/lesson-context.service.ts apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts
git commit -m "feat: pass ttsModel through lesson start flow"
```

---

### Task 4: Frontend — accept dynamic TTS model

**Files:**
- Modify: `apps/web/src/types/index.ts:11-16`
- Modify: `apps/web/src/hooks/useTutorTts.ts` (interface + openWs)
- Modify: `apps/web/src/hooks/useLessonState.ts` (store ttsModel, pass to TTS calls)

**Step 1: Add `ttsModel` to `UserPreferences` type**

In `types/index.ts`, add to `UserPreferences` (after `speakingSpeed`, line 15):

```typescript
ttsModel?: string;
```

**Step 2: Add `model` parameter to TTS hook functions**

In `useTutorTts.ts`, update the `UseTutorTtsReturn` interface (lines 39-47):

```typescript
interface UseTutorTtsReturn {
  speak: (text: string, voiceId: string, speechSpeed?: number, model?: string) => void;
  preWarm: (voiceId: string, speechSpeed?: number, model?: string) => void;
  startStream: (voiceId: string, speechSpeed?: number, model?: string) => void;
  sendChunk: (text: string) => void;
  endStream: () => void;
  stop: () => void;
  isSpeaking: boolean;
}
```

**Step 3: Thread `model` parameter through `openWs`**

In `useTutorTts.ts`, update the `openWs` signature (line 255-256):

```typescript
async (voiceId: string, speechSpeed: number, onReady: () => void, model?: string) => {
```

And update the WS URL (line 271) to use `model ?? TTS_CONFIG.MODEL`:

Change:
```typescript
const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${TTS_CONFIG.MODEL}&output_format=${TTS_CONFIG.OUTPUT_FORMAT}&single_use_token=${token}`;
```

To:
```typescript
const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${model ?? TTS_CONFIG.MODEL}&output_format=${TTS_CONFIG.OUTPUT_FORMAT}&single_use_token=${token}`;
```

**Step 4: Update `speak`, `preWarm`, `startStream` to pass `model`**

Update `speak` (line 381-392):
```typescript
const speak = useCallback(
  (text: string, voiceId: string, speechSpeed?: number, model?: string) => {
    if (!text.trim()) return;
    log("speak:", text.slice(0, 50), "voiceId:", voiceId);

    void openWs(voiceId, speechSpeed ?? 1.0, () => {
      sendTextToWs(text, true);
      sendEos();
    }, model);
  },
  [openWs, sendTextToWs, sendEos],
);
```

Update `preWarm` (line 395-403):
```typescript
const preWarm = useCallback(
  (voiceId: string, speechSpeed?: number, model?: string) => {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (wsRef.current || connectingRef.current) return;
    log("preWarm");
    void openWs(voiceId, speechSpeed ?? 1.0, () => {}, model);
  },
  [openWs],
);
```

Update `startStream` (line 406-424):
```typescript
const startStream = useCallback(
  (voiceId: string, speechSpeed?: number, model?: string) => {
    log("startStream, voiceId:", voiceId);
    isStreamingRef.current = true;
    eosRequestedRef.current = false;

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (wsRef.current || connectingRef.current) {
      log("startStream: reusing pre-warmed WS");
      return;
    }

    pendingTextRef.current = [];
    void openWs(voiceId, speechSpeed ?? 1.0, () => {}, model);
  },
  [openWs],
);
```

**Step 5: Store `ttsModel` in `useLessonState` and pass to TTS calls**

In `useLessonState.ts`, add a ref after `speechSpeedRef` (line 33):

```typescript
const ttsModelRef = useRef<string | undefined>(undefined);
```

In the `handleEvent` callback, update the `lesson_started` handler (lines 109-113):

```typescript
if (event === "lesson_started") {
  const d = data as LessonEventData & { voiceId?: string; speechSpeed?: number; ttsModel?: string };
  if (d.voiceId) voiceIdRef.current = d.voiceId;
  if (d.speechSpeed != null) speechSpeedRef.current = d.speechSpeed;
  if (d.ttsModel) ttsModelRef.current = d.ttsModel;
}
```

Update all TTS calls to pass `ttsModelRef.current`:

Line 154 (speak):
```typescript
ttsRef.current.speak(action.text, voiceIdRef.current, speechSpeedRef.current, ttsModelRef.current);
```

Line 178 (startStream):
```typescript
ttsRef.current.startStream(voiceIdRef.current, speechSpeedRef.current, ttsModelRef.current);
```

Line 269 (preWarm):
```typescript
ttsRef.current.preWarm(voiceIdRef.current, speechSpeedRef.current, ttsModelRef.current);
```

**Step 6: Verify build**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/web type-check`
Expected: PASS

**Step 7: Commit**

```bash
git add apps/web/src/types/index.ts apps/web/src/hooks/useTutorTts.ts apps/web/src/hooks/useLessonState.ts
git commit -m "feat: pass dynamic TTS model from lesson to ElevenLabs WS"
```

---

### Task 5: Build SettingsDrawer component

**Files:**
- Create: `apps/web/src/components/settings/SettingsDrawer.tsx`

**Step 1: Create the drawer component**

Create `apps/web/src/components/settings/SettingsDrawer.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { UserPreferences } from "@/types";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

const TTS_MODELS = [
  { value: "eleven_turbo_v2_5", label: "Turbo v2.5", desc: "Fast" },
  { value: "eleven_multilingual_v2", label: "Multilingual v2", desc: "Best quality" },
  { value: "eleven_flash_v2_5", label: "Flash v2.5", desc: "Fastest" },
] as const;

const SPEEDS = [
  { value: "very_slow", label: "Very Slow" },
  { value: "slow", label: "Slow" },
  { value: "natural", label: "Natural" },
  { value: "fast", label: "Fast" },
  { value: "very_fast", label: "Very Fast" },
] as const;

const CORRECTION_STYLES = [
  { value: "immediate", label: "Immediate" },
  { value: "end_of_lesson", label: "End of Lesson" },
  { value: "natural", label: "Natural" },
] as const;

export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.auth.me().then((res) => {
      setPrefs(res.user_preferences ?? {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [open]);

  const save = useCallback(async (patch: Partial<UserPreferences>) => {
    setPrefs((prev) => prev ? { ...prev, ...patch } : patch);
    try {
      await api.auth.updatePreferences(patch);
    } catch {
      // Silently fail — preference will be stale until next reload
    }
  }, []);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 overflow-y-auto animate-slide-in-right">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-gray-400">Loading...</div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Voice Section */}
            <section>
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Voice</h3>
              <div className="space-y-4">
                <SelectField
                  label="TTS Model"
                  value={prefs?.ttsModel ?? "eleven_turbo_v2_5"}
                  options={TTS_MODELS.map((m) => ({ value: m.value, label: `${m.label} (${m.desc})` }))}
                  onChange={(v) => save({ ttsModel: v })}
                />
                <SelectField
                  label="Speaking Speed"
                  value={prefs?.speakingSpeed ?? "very_slow"}
                  options={SPEEDS.map((s) => ({ value: s.value, label: s.label }))}
                  onChange={(v) => save({ speakingSpeed: v })}
                />
              </div>
            </section>

            {/* Lesson Section */}
            <section>
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Lesson</h3>
              <div className="space-y-4">
                <SelectField
                  label="Correction Style"
                  value={prefs?.correctionStyle ?? "immediate"}
                  options={CORRECTION_STYLES.map((c) => ({ value: c.value, label: c.label }))}
                  onChange={(v) => save({ correctionStyle: v })}
                />
                <ToggleField
                  label="Explain Grammar"
                  checked={prefs?.explainGrammar ?? true}
                  onChange={(v) => save({ explainGrammar: v })}
                />
                <ToggleField
                  label="Use Native Language"
                  checked={prefs?.useNativeLanguage ?? false}
                  onChange={(v) => save({ useNativeLanguage: v })}
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? "bg-primary-600" : "bg-gray-200"}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
```

**Step 2: Add slide-in animation to global CSS**

Find the global CSS file and add:

```css
@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.animate-slide-in-right {
  animation: slide-in-right 0.2s ease-out;
}
```

**Step 3: Verify build**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/web type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/components/settings/SettingsDrawer.tsx apps/web/src/app/globals.css
git commit -m "feat: add SettingsDrawer component"
```

---

### Task 6: Add gear icon to AppHeader

**Files:**
- Modify: `apps/web/src/components/layout/app-header.tsx`

**Step 1: Add settings state and drawer**

Replace `app-header.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBackendSession } from "@/hooks/useBackendSession";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";

export function AppHeader() {
  const { session, user } = useBackendSession();
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (pathname === "/lesson") return null;

  return (
    <>
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 lg:px-6 flex items-center justify-between h-14">
          <Link href="/dashboard" className="font-bold text-xl text-primary-700 hover:text-primary-500 transition-colors">
            Jake
          </Link>
          <div className="flex items-center gap-3">
            {session?.user?.image && (
              <Image
                src={session.user.image}
                alt=""
                width={32}
                height={32}
                className="rounded-full ring-2 ring-gray-100"
              />
            )}
            <span className="text-sm text-gray-600 hidden sm:block">
              {user?.name ?? session?.user?.name}
            </span>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
              title="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/web type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/components/layout/app-header.tsx
git commit -m "feat: add gear icon to header to open settings drawer"
```

---

### Task 7: Revert hardcoded model change

**Files:**
- Modify: `apps/web/src/lib/config.ts:49`

**Step 1: Revert MODEL back to default**

The earlier commit changed `MODEL` to `eleven_multilingual_v2`. Now that we have dynamic model selection, revert to the safe default:

Change:
```typescript
MODEL: "eleven_multilingual_v2",
```

To:
```typescript
MODEL: "eleven_turbo_v2_5",
```

**Step 2: Verify build**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/web type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/lib/config.ts
git commit -m "fix: revert hardcoded TTS model to turbo_v2_5 (now configurable)"
```

---

### Task 8: Verify end-to-end

**Step 1: Run type-check and lint**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm type-check && pnpm lint`
Expected: PASS

**Step 2: Run tests**

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/web test && pnpm --filter @jake/api test`
Expected: PASS
