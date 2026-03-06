# Error Handling UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add user-visible error handling across the app — global error boundaries, toast notifications for lesson errors, and visual mic error state in controls.

**Architecture:** Three layers: (1) Global Error Boundary via Next.js `error.tsx` files for React crashes, (2) Toast notifications for transient lesson errors (STT/TTS/WS), (3) Visual indicator on mic button when STT has an error.

**Tech Stack:** Next.js 14 App Router `error.tsx`, existing Toast system (`useToast`), Tailwind CSS.

---

### Task 1: Global Error Boundary — App Layout

**Files:**
- Create: `apps/web/src/app/(app)/error.tsx`

**Step 1: Create error boundary**

```tsx
"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-gray-500 mb-6">An unexpected error occurred. Please try again.</p>
        <button
          type="button"
          onClick={reset}
          className="btn-primary"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify lint and type-check pass**

Run: `pnpm --filter @jake/web type-check && pnpm --filter @jake/web lint`

**Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/error.tsx"
git commit -m "feat: add global error boundary for app layout"
```

---

### Task 2: Global Error Boundary — Lesson Layout

**Files:**
- Create: `apps/web/src/app/(lesson)/error.tsx`

**Step 1: Create lesson error boundary**

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LessonError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Lesson error:", error);
  }, [error]);

  return (
    <div className="min-h-screen lesson-gradient flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Lesson interrupted</h1>
        <p className="text-white/60 mb-6">Something went wrong during your lesson.</p>
        <button
          type="button"
          onClick={() => { router.push("/dashboard"); }}
          className="bg-white text-primary-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify lint and type-check pass**

Run: `pnpm --filter @jake/web type-check && pnpm --filter @jake/web lint`

**Step 3: Commit**

```bash
git add "apps/web/src/app/(lesson)/error.tsx"
git commit -m "feat: add error boundary for lesson layout"
```

---

### Task 3: Toast on WS disconnect — redirect with message

Currently `LessonScreen.tsx` silently redirects to dashboard on WS error or server lesson end. Add toast message so user knows what happened.

**Files:**
- Modify: `apps/web/src/components/lesson/LessonScreen.tsx`

**Step 1: Import `useToast` and show toast before redirect**

Add import:
```tsx
import { useToast } from "@/components/ui/Toast";
```

Add hook in component:
```tsx
const { showToast } = useToast();
```

Update error effect (lines ~124-130):
```tsx
useEffect(() => {
  if (lessonError) {
    stt.disable();
    stopAllAudio();
    showToast(lessonError, "error");
    router.push("/dashboard");
  }
}, [lessonError, stt, stopAllAudio, router, showToast]);
```

Update serverLessonEnded effect (lines ~116-122):
```tsx
useEffect(() => {
  if (serverLessonEnded) {
    stt.disable();
    stopAllAudio();
    showToast("Lesson ended", "info");
    router.push("/dashboard");
  }
}, [serverLessonEnded, stt, router, stopAllAudio, showToast]);
```

**Step 2: Verify lint and type-check pass**

Run: `pnpm --filter @jake/web type-check && pnpm --filter @jake/web lint`

**Step 3: Commit**

```bash
git add "apps/web/src/components/lesson/LessonScreen.tsx"
git commit -m "feat: show toast on lesson error before redirect"
```

---

### Task 4: STT error toast + mic error indicator

Show toast when STT fails, and add yellow error state to mic button.

**Files:**
- Modify: `apps/web/src/components/lesson/LessonScreen.tsx`
- Modify: `apps/web/src/components/lesson/LessonControls.tsx`

**Step 1: Add `sttError` prop to LessonControls**

In `LessonControls.tsx`, add `sttError` to props interface:
```tsx
interface LessonControlsProps {
  isPaused: boolean;
  isMuted: boolean;
  sttError: string | null;
  onTogglePause: () => void;
  onToggleMute: () => void;
}
```

Update destructuring:
```tsx
export function LessonControls({
  isPaused,
  isMuted,
  sttError,
  onTogglePause,
  onToggleMute,
}: LessonControlsProps) {
```

Add yellow error state to mic button. The mic button class logic becomes:
```tsx
<div
  className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
    isPaused
      ? "bg-white/10 opacity-40"
      : sttError
        ? "bg-yellow-500 shadow-lg shadow-yellow-500/30 hover:bg-yellow-400"
        : isMuted
          ? "bg-red-500 shadow-lg shadow-red-500/30 hover:bg-red-400"
          : "bg-white shadow-lg shadow-white/20 hover:scale-105 active:scale-95"
  }`}
>
```

Update mic icon color — when `sttError`, show warning icon:
```tsx
{isPaused ? (
  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9l4.17 4.18L21 19.73 4.27 3z"/>
  </svg>
) : sttError ? (
  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
) : isMuted ? (
  /* existing muted icon */
) : (
  /* existing active mic icon */
)}
```

Update status text:
```tsx
<p className="text-white/30 text-xs text-center mt-3">
  {isPaused ? "Lesson paused" : sttError ? "Mic error — tap to retry" : isMuted ? "Microphone off" : "Listening..."}
</p>
```

**Step 2: Pass `sttError` from LessonScreen and show toast on STT error**

In `LessonScreen.tsx`, add an effect to show toast when `stt.error` changes:
```tsx
useEffect(() => {
  if (stt.error) {
    showToast(stt.error, "error");
  }
}, [stt.error, showToast]);
```

Pass to controls:
```tsx
<LessonControls
  isPaused={isPaused}
  isMuted={isMuted}
  sttError={stt.error}
  onTogglePause={handleTogglePause}
  onToggleMute={handleToggleMute}
/>
```

When user taps mic with `sttError`, `handleToggleMute` already calls `stt.enable()` which resets error and retries.

**Step 3: Verify lint and type-check pass**

Run: `pnpm --filter @jake/web type-check && pnpm --filter @jake/web lint`

**Step 4: Commit**

```bash
git add "apps/web/src/components/lesson/LessonControls.tsx" "apps/web/src/components/lesson/LessonScreen.tsx"
git commit -m "feat: show STT errors as toast and yellow mic indicator"
```

---

### Task 5: TTS error toast

Add `onError` callback to `useTutorTts` so LessonScreen can show a toast.

**Files:**
- Modify: `apps/web/src/hooks/useTutorTts.ts`
- Modify: `apps/web/src/components/lesson/LessonScreen.tsx`

**Step 1: Add `onError` callback to useTutorTts**

Add to interface:
```tsx
interface UseTutorTtsOptions {
  onAllDone?: () => void;
  onPlaybackStart?: () => void;
  onPlaybackProgress?: (playedSeconds: number, totalDecodedSeconds: number, allReceived: boolean) => void;
  onError?: (message: string) => void;
}
```

Call `onError` in `ws.onerror` handler (line ~316):
```tsx
ws.onerror = () => {
  log("WS error");
  optionsRef.current?.onError?.("Voice temporarily unavailable");
  if (wsRef.current === ws) {
    closeWs();
  }
};
```

Call `onError` in token fetch catch block (line ~336):
```tsx
catch (error) {
  log("failed to open TTS WS:", error);
  connectingRef.current = false;
  optionsRef.current?.onError?.("Voice temporarily unavailable");
  closeWs();
}
```

**Step 2: Wire up in LessonScreen (useLessonState)**

In `useLessonState.ts`, add `onTtsError` callback param and pass to `useTutorTts`:

Add to the `useTutorTts` call in `useLessonState.ts`:
```tsx
const tts = useTutorTts({
  onAllDone: () => { /* existing */ },
  onPlaybackProgress: (playedSec, totalDecodedSec, allReceived) => { /* existing */ },
  onError: (message) => {
    log("TTS error:", message);
  },
});
```

Also expose `ttsError` state from `useLessonState`:
```tsx
// Add state
const [ttsError, setTtsError] = useState<string | null>(null);

// In useTutorTts options:
onError: (message) => {
  log("TTS error:", message);
  setTtsError(message);
},

// In return:
return {
  ...state,
  connected,
  isPlaying: tts.isSpeaking,
  ttsError,
  sendText,
  /* rest */
};
```

**Step 3: Show toast in LessonScreen**

In `LessonScreen.tsx`, destructure `ttsError` from `useLessonState` and show toast:
```tsx
const { ..., ttsError } = useLessonState(token);

useEffect(() => {
  if (ttsError) {
    showToast(ttsError, "error");
  }
}, [ttsError, showToast]);
```

**Step 4: Verify lint and type-check pass**

Run: `pnpm --filter @jake/web type-check && pnpm --filter @jake/web lint`

**Step 5: Commit**

```bash
git add "apps/web/src/hooks/useTutorTts.ts" "apps/web/src/hooks/useLessonState.ts" "apps/web/src/components/lesson/LessonScreen.tsx"
git commit -m "feat: show toast on TTS errors"
```

---

### Summary

| Task | What | Files |
|------|------|-------|
| 1 | Error boundary for app pages | `(app)/error.tsx` |
| 2 | Error boundary for lesson page | `(lesson)/error.tsx` |
| 3 | Toast on WS disconnect/lesson end | `LessonScreen.tsx` |
| 4 | STT error toast + yellow mic | `LessonControls.tsx`, `LessonScreen.tsx` |
| 5 | TTS error toast | `useTutorTts.ts`, `useLessonState.ts`, `LessonScreen.tsx` |
