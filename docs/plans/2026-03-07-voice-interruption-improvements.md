# Voice Interruption & Turn Detection Improvements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve voice lesson UX by adding greeting mute, backchannel guard, graceful interruption with partial text preservation, dynamic silence timing, and transcript similarity abort.

**Architecture:** All changes are isolated to the WebSocket gateway (server) and lesson hooks (client). No DB schema changes. Each feature is independent and can be shipped separately. Features 1-2 are client-only, 3-5 touch both client and server.

**Tech Stack:** TypeScript, NestJS (server), React hooks (client), Socket.IO, Deepgram STT, ElevenLabs TTS

---

## Task 1: Mute During Greeting

Prevent accidental interruption (cough, background noise) while the tutor's greeting is playing.

**Files:**
- Modify: `apps/web/src/hooks/useLessonState.ts:295-317` (interruptTutor)
- Modify: `apps/web/src/hooks/useLessonState.ts:108-117` (handleEvent — lesson_started)
- Modify: `apps/web/src/hooks/useLessonState.ts:148-168` (show_message for greeting)
- Modify: `apps/web/src/components/lesson/LessonScreen.tsx:56-65` (onSegment callback)
- Test: `apps/web/src/hooks/lesson/handleLessonEvent.spec.ts`

### Step 1: Add `greetingPlayingRef` to useLessonState

In `useLessonState.ts`, add a ref to track greeting state:

```typescript
// After line 36 (streamStartedRef)
const greetingPlayingRef = useRef(false);
```

In `handleEvent`, when `lesson_started` arrives, set the flag:

```typescript
// Inside the lesson_started handler (around line 111-117)
if (event === "lesson_started") {
  const d = data as LessonEventData & { voiceId?: string; speechSpeed?: number; ttsModel?: string; systemPrompt?: string };
  if (d.voiceId) voiceIdRef.current = d.voiceId;
  if (d.speechSpeed != null) speechSpeedRef.current = d.speechSpeed;
  if (d.ttsModel) ttsModelRef.current = d.ttsModel;
  if (d.systemPrompt) systemPromptRef.current = d.systemPrompt;
  greetingPlayingRef.current = true; // <-- ADD THIS
}
```

In the `show_message` handler for greeting (the first `tutor_message` after `lesson_started`), clear it in `onAllDone`. The greeting uses `tts.speak()` which fires `onAllDone` when done. We need to clear the flag there.

In the `onAllDone` callback of `useTutorTts` (around line 48-66), add:

```typescript
onAllDone: () => {
  greetingPlayingRef.current = false; // <-- ADD THIS
  // ... existing code
}
```

### Step 2: Guard interruptTutor and onSegment

In `interruptTutor` (line 295), add early return:

```typescript
const interruptTutor = useCallback(() => {
  if (greetingPlayingRef.current) return; // <-- ADD THIS
  tts.stop();
  emit("interrupt", {});
  // ... rest unchanged
}, [tts, emit]);
```

Expose `greetingPlayingRef` for LessonScreen:

```typescript
return {
  ...state,
  connected,
  isPlaying: tts.isSpeaking,
  isGreetingPlaying: greetingPlayingRef.current, // <-- ADD THIS
  // ... rest unchanged
};
```

In `LessonScreen.tsx` onSegment callback (line 56-65), guard:

```typescript
onSegment: (text: string) => {
  if (isTutorActiveRef.current && !isGreetingPlayingRef.current) { // <-- GUARD
    setUserSpeaking(true);
    interruptTutor();
    speechBuffer.clear();
    setLiveTranscript("");
  }
  speechBuffer.push(text);
  setLiveTranscript(speechBuffer.getText());
},
```

Add the ref in LessonScreen:

```typescript
const isGreetingPlayingRef = useRef(false);
// Update it from useLessonState return value (or use the ref directly from interruptTutor guard)
```

**Simpler approach:** Since `interruptTutor` already guards with the ref, the LessonScreen doesn't need its own ref. The `interruptTutor()` call will just be a no-op during greeting. But we still want to avoid buffering segments during greeting that would fire immediately after. So buffer the segments normally — they'll just be sent as the first user message after greeting, which is fine.

### Step 3: Run tests

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/web test`

Expected: All existing tests pass.

### Step 4: Commit

```bash
git add apps/web/src/hooks/useLessonState.ts apps/web/src/components/lesson/LessonScreen.tsx
git commit -m "feat: mute interruptions during greeting playback"
```

---

## Task 2: MinWords Guard (Backchannel Protection)

Prevent short utterances ("yeah", "ok", "uh-huh", "mm") from interrupting the tutor.

**Files:**
- Create: `apps/web/src/lib/backchannel.ts`
- Create: `apps/web/src/lib/backchannel.spec.ts`
- Modify: `apps/web/src/components/lesson/LessonScreen.tsx:56-65` (onSegment callback)

### Step 1: Write the backchannel detection module with tests

Create `apps/web/src/lib/backchannel.ts`:

```typescript
const BACKCHANNEL_PHRASES = new Set([
  "yeah", "yes", "yep", "yup",
  "no", "nope", "nah",
  "ok", "okay", "k",
  "uh-huh", "uh huh", "uhuh",
  "mm", "mmm", "mhm", "mm-hmm", "hmm",
  "ah", "oh", "uh",
  "right", "sure", "fine",
  "wow", "cool", "nice",
  "thanks", "thank you",
  "got it", "I see",
]);

const MIN_WORDS_TO_INTERRUPT = 3;

export function isBackchannel(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[.,!?]/g, "");
  if (BACKCHANNEL_PHRASES.has(normalized)) return true;
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return wordCount < MIN_WORDS_TO_INTERRUPT;
}
```

Create `apps/web/src/lib/backchannel.spec.ts`:

```typescript
import { isBackchannel } from "./backchannel";

describe("isBackchannel", () => {
  it("detects single-word backchannels", () => {
    expect(isBackchannel("yeah")).toBe(true);
    expect(isBackchannel("Ok")).toBe(true);
    expect(isBackchannel("Mm-hmm")).toBe(true);
    expect(isBackchannel("Sure")).toBe(true);
  });

  it("detects short phrases as backchannel", () => {
    expect(isBackchannel("I see")).toBe(true);
    expect(isBackchannel("got it")).toBe(true);
    expect(isBackchannel("oh ok")).toBe(true);
  });

  it("rejects real sentences", () => {
    expect(isBackchannel("I want to practice grammar")).toBe(false);
    expect(isBackchannel("Can we talk about travel")).toBe(false);
    expect(isBackchannel("Let me think about that")).toBe(false);
  });

  it("handles punctuation", () => {
    expect(isBackchannel("Yeah!")).toBe(true);
    expect(isBackchannel("Ok.")).toBe(true);
  });

  it("treats two unknown words as backchannel", () => {
    expect(isBackchannel("hello there")).toBe(true);
  });

  it("allows three+ word sentences", () => {
    expect(isBackchannel("I like pizza")).toBe(false);
  });
});
```

### Step 2: Run the test to verify it passes

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/web test -- --testPathPattern backchannel`

Expected: PASS

### Step 3: Integrate into LessonScreen

In `apps/web/src/components/lesson/LessonScreen.tsx`, import and use:

```typescript
import { isBackchannel } from "@/lib/backchannel";

// In onSegment callback (line 56-65):
onSegment: (text: string) => {
  if (isTutorActiveRef.current && !isBackchannel(text)) { // <-- GUARD
    setUserSpeaking(true);
    interruptTutor();
    speechBuffer.clear();
    setLiveTranscript("");
  }
  speechBuffer.push(text);
  setLiveTranscript(speechBuffer.getText());
},
```

Note: This combines with the greeting guard from Task 1. The full condition becomes:
```typescript
if (isTutorActiveRef.current && !isBackchannel(text)) {
```
The greeting guard lives inside `interruptTutor()` itself, so no need to check it here.

### Step 4: Run all tests

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/web test`

Expected: All PASS

### Step 5: Commit

```bash
git add apps/web/src/lib/backchannel.ts apps/web/src/lib/backchannel.spec.ts apps/web/src/components/lesson/LessonScreen.tsx
git commit -m "feat: add backchannel guard to prevent short utterances from interrupting tutor"
```

---

## Task 3: Graceful Interruption (Preserve Partial Response)

When user interrupts, save the already-sent partial text to conversation history instead of discarding it.

**Files:**
- Modify: `apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts:164-172` (handleInterrupt)
- Modify: `apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts:126-213` (processTextMessageStreaming)
- Modify: `apps/api/src/@logic/lesson/application/service/lesson-session.service.ts` (add sentChunks tracking)
- Test: existing API tests

### Step 1: Track sent chunks on the server

The streaming pipeline already sends chunks via `onChunk` callback. We need to accumulate the text of chunks that were successfully sent to the client.

In `lesson.gateway.ts`, track emitted text per socket:

```typescript
// Add a new Map after abortControllers (line 35)
private sentChunksText = new Map<string, string>();
```

In `handleText` (line 109), reset on new message and accumulate in onChunk:

```typescript
// After creating abortController (line 125)
this.sentChunksText.set(client.id, "");

// In onChunk callback (line 136-138):
onChunk: (chunk) => {
  const current = this.sentChunksText.get(client.id) ?? "";
  this.sentChunksText.set(client.id, current + (current ? " " : "") + chunk.text);
  client.emit("tutor_chunk", { ...chunk, messageId });
},

// In onEnd (line 139-144):
onEnd: (result) => {
  this.abortControllers.delete(client.id);
  this.sentChunksText.delete(client.id);
  // ... rest unchanged
},

// In onError (line 146-149):
onError: (error) => {
  this.abortControllers.delete(client.id);
  this.sentChunksText.delete(client.id);
  // ... rest unchanged
},

// In onDiscard (line 151-155):
onDiscard: (safetyText) => {
  this.abortControllers.delete(client.id);
  this.sentChunksText.delete(client.id);
  // ... rest unchanged
},
```

### Step 2: Save partial text on interrupt

Modify `handleInterrupt` (line 164-172):

```typescript
@SubscribeMessage("interrupt")
async handleInterrupt(@ConnectedSocket() client: Socket) {
  const controller = this.abortControllers.get(client.id);
  if (controller) {
    controller.abort();
    this.abortControllers.delete(client.id);

    // Save partial response to history if any text was sent
    const partialText = this.sentChunksText.get(client.id);
    this.sentChunksText.delete(client.id);

    if (partialText?.trim()) {
      const session = await this.sessionService.get(client.id);
      if (session) {
        await this.sessionService.appendHistory(client.id, {
          role: "assistant",
          content: partialText.trim() + "...",
        });
      }
    }

    this.logger.debug(`Interrupted streaming for ${client.id}`);
  }
}
```

### Step 3: Also save user message on interrupt

Currently the user message is only saved to DB/history in `onEnd`. If interrupted, neither user nor assistant message is saved. We need to save the user message at the START of processing, not the end.

In `lesson.gateway.ts` `handleText`, save user text to a map:

```typescript
// Add after sentChunksText map (line 35)
private pendingUserText = new Map<string, string>();

// In handleText, after abortController setup (line 125):
this.pendingUserText.set(client.id, parsed.data.text);

// In onEnd, clean up:
this.pendingUserText.delete(client.id);

// In onError/onDiscard, clean up:
this.pendingUserText.delete(client.id);
```

Update `handleInterrupt` to also save user message:

```typescript
@SubscribeMessage("interrupt")
async handleInterrupt(@ConnectedSocket() client: Socket) {
  const controller = this.abortControllers.get(client.id);
  if (controller) {
    controller.abort();
    this.abortControllers.delete(client.id);

    const partialText = this.sentChunksText.get(client.id);
    const userText = this.pendingUserText.get(client.id);
    this.sentChunksText.delete(client.id);
    this.pendingUserText.delete(client.id);

    if (userText?.trim() || partialText?.trim()) {
      const session = await this.sessionService.get(client.id);
      if (session) {
        const messages: LlmMessage[] = [];
        if (userText?.trim()) messages.push({ role: "user", content: userText.trim() });
        if (partialText?.trim()) messages.push({ role: "assistant", content: partialText.trim() + "..." });
        if (messages.length > 0) {
          await this.sessionService.appendHistory(client.id, ...messages);
        }
      }
    }

    this.logger.debug(`Interrupted streaming for ${client.id}`);
  }
}
```

Add import for LlmMessage at top of gateway:

```typescript
import type { LlmMessage } from "@lib/provider/src";
```

### Step 4: Clean up maps on disconnect

In `handleDisconnect` (line 98-107):

```typescript
async handleDisconnect(client: Socket) {
  this.abortControllers.get(client.id)?.abort();
  this.abortControllers.delete(client.id);
  this.sentChunksText.delete(client.id);
  this.pendingUserText.delete(client.id);

  // ... rest unchanged
}
```

### Step 5: Run tests

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/api test`

Expected: All PASS

### Step 6: Commit

```bash
git add apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts
git commit -m "feat: preserve partial tutor response in history on user interruption"
```

---

## Task 4: Dynamic Silence Duration by Punctuation

Instead of fixed 500ms silence timeout (`LESSON_CONFIG.SILENCE_MS`), adjust the wait time based on the punctuation of the last segment.

**Files:**
- Modify: `apps/web/src/hooks/useSpeechBuffer.ts`
- Modify: `apps/web/src/lib/config.ts` (add silence config)
- Create: `apps/web/src/lib/silence-duration.ts`
- Create: `apps/web/src/lib/silence-duration.spec.ts`

### Step 1: Create silence duration module with tests

Create `apps/web/src/lib/silence-duration.ts`:

```typescript
/**
 * Determine how long to wait after silence before flushing the speech buffer.
 * Inspired by RealtimeVoiceChat's punctuation-based pause system.
 *
 * Short pauses for complete sentences (. ! ?),
 * longer pauses for incomplete thoughts (no punctuation, ellipsis).
 */

interface SilenceDurationConfig {
  period: number;      // "I went to the store."
  question: number;    // "What do you think?"
  exclamation: number; // "That's great!"
  ellipsis: number;    // "I think..."
  noPunctuation: number; // "I went to the"
}

export const SILENCE_DURATIONS: SilenceDurationConfig = {
  period: 400,
  question: 350,
  exclamation: 350,
  ellipsis: 1500,
  noPunctuation: 800,
};

export function getSilenceDuration(text: string): number {
  const trimmed = text.trimEnd();
  if (!trimmed) return SILENCE_DURATIONS.noPunctuation;

  const lastChar = trimmed[trimmed.length - 1];

  if (trimmed.endsWith("...") || trimmed.endsWith("…")) return SILENCE_DURATIONS.ellipsis;
  if (lastChar === ".") return SILENCE_DURATIONS.period;
  if (lastChar === "?") return SILENCE_DURATIONS.question;
  if (lastChar === "!") return SILENCE_DURATIONS.exclamation;

  return SILENCE_DURATIONS.noPunctuation;
}
```

Create `apps/web/src/lib/silence-duration.spec.ts`:

```typescript
import { getSilenceDuration, SILENCE_DURATIONS } from "./silence-duration";

describe("getSilenceDuration", () => {
  it("returns period duration for sentences ending with .", () => {
    expect(getSilenceDuration("I went to the store.")).toBe(SILENCE_DURATIONS.period);
  });

  it("returns question duration for questions", () => {
    expect(getSilenceDuration("What do you think?")).toBe(SILENCE_DURATIONS.question);
  });

  it("returns exclamation duration", () => {
    expect(getSilenceDuration("That's great!")).toBe(SILENCE_DURATIONS.exclamation);
  });

  it("returns ellipsis duration for trailing dots", () => {
    expect(getSilenceDuration("I think...")).toBe(SILENCE_DURATIONS.ellipsis);
    expect(getSilenceDuration("Well\u2026")).toBe(SILENCE_DURATIONS.ellipsis);
  });

  it("returns noPunctuation for incomplete text", () => {
    expect(getSilenceDuration("I went to the")).toBe(SILENCE_DURATIONS.noPunctuation);
  });

  it("handles trailing whitespace", () => {
    expect(getSilenceDuration("Hello.  ")).toBe(SILENCE_DURATIONS.period);
  });

  it("handles empty string", () => {
    expect(getSilenceDuration("")).toBe(SILENCE_DURATIONS.noPunctuation);
  });
});
```

### Step 2: Run the test

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/web test -- --testPathPattern silence-duration`

Expected: PASS

### Step 3: Integrate into useSpeechBuffer

Modify `apps/web/src/hooks/useSpeechBuffer.ts`:

```typescript
import { useRef, useCallback, useEffect, useMemo } from "react";
import { getSilenceDuration } from "@/lib/silence-duration";

interface UseSpeechBufferOptions {
  onFlush: (text: string) => void;
  onSpeechDone: () => void;
}

export function useSpeechBuffer({ onFlush, onSpeechDone }: UseSpeechBufferOptions) {
  const bufferRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const text = bufferRef.current.join(" ").trim();
    bufferRef.current = [];
    timerRef.current = null;
    if (text) {
      onFlush(text);
    }
    onSpeechDone();
  }, [onFlush, onSpeechDone]);

  const push = useCallback((segment: string) => {
    bufferRef.current.push(segment);
    if (timerRef.current) clearTimeout(timerRef.current);
    const silenceMs = getSilenceDuration(segment);
    timerRef.current = setTimeout(flush, silenceMs);
  }, [flush]);

  const clear = useCallback(() => {
    bufferRef.current = [];
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const getText = useCallback(() => {
    return bufferRef.current.join(" ");
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useMemo(() => ({ push, clear, flush, getText }), [push, clear, flush, getText]);
}
```

Remove `LESSON_CONFIG.SILENCE_MS` import (it's no longer used here). Keep the config entry in case it's used elsewhere.

### Step 4: Run all tests

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/web test`

Expected: All PASS

### Step 5: Commit

```bash
git add apps/web/src/lib/silence-duration.ts apps/web/src/lib/silence-duration.spec.ts apps/web/src/hooks/useSpeechBuffer.ts
git commit -m "feat: dynamic silence duration based on punctuation for better turn detection"
```

---

## Task 5: Text Similarity Abort

If Deepgram significantly revises the transcript after we've already started generating, abort and regenerate.

**Files:**
- Create: `apps/web/src/lib/text-similarity.ts`
- Create: `apps/web/src/lib/text-similarity.spec.ts`
- Modify: `apps/web/src/hooks/useLessonState.ts` (track last sent text, compare on new segment)
- Modify: `apps/web/src/components/lesson/LessonScreen.tsx` (onSegment logic)

### Step 1: Create text similarity module with tests

Create `apps/web/src/lib/text-similarity.ts`:

```typescript
/**
 * Simple word-overlap similarity (Jaccard-like).
 * Returns 0.0 (no overlap) to 1.0 (identical).
 */
export function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));

  if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0.0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

const SIMILARITY_THRESHOLD = 0.5;

export function shouldAbortForRevision(lastSentText: string, newText: string): boolean {
  if (!lastSentText) return false;
  return textSimilarity(lastSentText, newText) < SIMILARITY_THRESHOLD;
}
```

Create `apps/web/src/lib/text-similarity.spec.ts`:

```typescript
import { textSimilarity, shouldAbortForRevision } from "./text-similarity";

describe("textSimilarity", () => {
  it("returns 1.0 for identical text", () => {
    expect(textSimilarity("hello world", "hello world")).toBe(1.0);
  });

  it("returns 0.0 for completely different text", () => {
    expect(textSimilarity("hello world", "foo bar")).toBe(0.0);
  });

  it("returns partial similarity for overlapping text", () => {
    const sim = textSimilarity("I like pizza", "I like pasta");
    expect(sim).toBeGreaterThan(0.3);
    expect(sim).toBeLessThan(0.9);
  });

  it("handles empty strings", () => {
    expect(textSimilarity("", "")).toBe(1.0);
    expect(textSimilarity("hello", "")).toBe(0.0);
  });
});

describe("shouldAbortForRevision", () => {
  it("returns false for empty lastSentText", () => {
    expect(shouldAbortForRevision("", "new text")).toBe(false);
  });

  it("returns false for similar text", () => {
    expect(shouldAbortForRevision(
      "I want to practice my English",
      "I want to practice my English today",
    )).toBe(false);
  });

  it("returns true for very different text", () => {
    expect(shouldAbortForRevision(
      "I want to practice my English",
      "Let's talk about cooking recipes",
    )).toBe(true);
  });
});
```

### Step 2: Run the test

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/web test -- --testPathPattern text-similarity`

Expected: PASS

### Step 3: Integrate into lesson flow

In `apps/web/src/hooks/useLessonState.ts`, add a ref to track the last text sent to server:

```typescript
// After streamStartedRef (line 36)
const lastSentTextRef = useRef<string>("");
```

In `sendText` (line 263-288), track what was sent:

```typescript
const sendText = useCallback(
  (text: string) => {
    if (!text.trim()) return;
    pendingTurnsRef.current++;
    const trimmed = text.trim();
    lastSentTextRef.current = trimmed; // <-- ADD THIS
    // ... rest unchanged
  },
  [emit],
);
```

Expose `lastSentTextRef` for LessonScreen:

```typescript
return {
  ...state,
  // ... existing fields
  lastSentText: lastSentTextRef.current, // <-- ADD THIS
};
```

Actually, simpler approach: just expose `lastSentTextRef` as a ref, or handle the abort logic directly in `LessonScreen.tsx`.

In `LessonScreen.tsx`, import and use:

```typescript
import { shouldAbortForRevision } from "@/lib/text-similarity";
```

Track last sent text with a ref:

```typescript
const lastSentTextRef = useRef("");
```

Wrap `sendText`:

```typescript
const wrappedSendText = useCallback((text: string) => {
  lastSentTextRef.current = text;
  sendText(text);
}, [sendText]);
```

Update `onFlush` in `useSpeechBuffer`:

```typescript
const speechBuffer = useSpeechBuffer({
  onFlush: useCallback((text: string) => {
    setLiveTranscript("");
    wrappedSendText(text);
  }, [wrappedSendText]),
  onSpeechDone: useCallback(() => { setUserSpeaking(false); }, [setUserSpeaking]),
});
```

In `onSegment`, check for revision:

```typescript
onSegment: (text: string) => {
  // Check if new segment drastically changes what we already sent
  if (status === "thinking" && lastSentTextRef.current) {
    const bufferedText = speechBuffer.getText();
    const fullNew = bufferedText ? bufferedText + " " + text : text;
    if (shouldAbortForRevision(lastSentTextRef.current, fullNew)) {
      // Abort current generation — the new text is very different
      interruptTutor();
      speechBuffer.clear();
      lastSentTextRef.current = "";
    }
  }

  if (isTutorActiveRef.current && !isBackchannel(text)) {
    setUserSpeaking(true);
    interruptTutor();
    speechBuffer.clear();
    setLiveTranscript("");
  }
  speechBuffer.push(text);
  setLiveTranscript(speechBuffer.getText());
},
```

### Step 4: Run all tests

Run: `cd /Users/aliaksandrnatashkin/WebstormProjects/jake && pnpm --filter @jake/web test`

Expected: All PASS

### Step 5: Manual test scenario

1. Start a lesson
2. Say a sentence, then quickly say something completely different
3. Verify the tutor's response matches the FINAL version of what you said, not the initial misrecognition

### Step 6: Commit

```bash
git add apps/web/src/lib/text-similarity.ts apps/web/src/lib/text-similarity.spec.ts apps/web/src/hooks/useLessonState.ts apps/web/src/components/lesson/LessonScreen.tsx
git commit -m "feat: abort and regenerate when Deepgram significantly revises transcript"
```

---

## Integration Notes

- All 5 tasks are independent and can be done in any order
- Tasks 1-2 are client-only (no server changes)
- Task 3 is server-only (no client changes needed — client already handles interrupt gracefully)
- Tasks 4-5 are client-only
- No DB migrations needed
- No new dependencies needed
- Run full test suite after all tasks: `pnpm lint && pnpm type-check && pnpm --filter @jake/api test && pnpm --filter @jake/web test`
