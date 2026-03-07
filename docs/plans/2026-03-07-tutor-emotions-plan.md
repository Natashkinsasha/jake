# Tutor Emotions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add emotional expressiveness to the tutor — Claude selects an emotion per response, which maps to ElevenLabs voice parameters and influences text tone.

**Architecture:** Claude outputs `<emotion>name</emotion>` at the start of each response. Backend extracts the emotion tag (similar to existing `<set_speed>` tag extraction), strips it from text, and sends the emotion name to the frontend via WebSocket events. Frontend uses the emotion to set ElevenLabs `voice_settings` when opening the TTS WebSocket.

**Tech Stack:** NestJS (backend), Next.js/React (frontend), ElevenLabs WebSocket API, Claude Sonnet

---

### Task 1: Emotion types and voice parameter map

**Files:**
- Create: `apps/api/src/@logic/lesson/application/service/emotion.ts`
- Test: `apps/api/src/@logic/lesson/application/service/emotion.spec.ts`

**Step 1: Write the failing tests**

```typescript
// emotion.spec.ts
import { parseEmotion, getVoiceSettingsForEmotion, EMOTIONS, type Emotion } from "./emotion";

describe("parseEmotion", () => {
  it("should extract emotion tag from start of text", () => {
    const result = parseEmotion("<emotion>happy</emotion>Great job today!");
    expect(result).toEqual({ emotion: "happy", text: "Great job today!" });
  });

  it("should return neutral when no tag present", () => {
    const result = parseEmotion("Just a normal message.");
    expect(result).toEqual({ emotion: "neutral", text: "Just a normal message." });
  });

  it("should return neutral for invalid emotion name", () => {
    const result = parseEmotion("<emotion>angry</emotion>Hey there!");
    expect(result).toEqual({ emotion: "neutral", text: "Hey there!" });
  });

  it("should handle whitespace around tag", () => {
    const result = parseEmotion("  <emotion>excited</emotion>  Wow, amazing!");
    expect(result).toEqual({ emotion: "excited", text: "Wow, amazing!" });
  });

  it("should handle tag with no following text", () => {
    const result = parseEmotion("<emotion>curious</emotion>");
    expect(result).toEqual({ emotion: "curious", text: "" });
  });

  it("should handle emotion tag mid-text (only first match)", () => {
    const result = parseEmotion("Hello <emotion>happy</emotion>world");
    expect(result).toEqual({ emotion: "happy", text: "Hello world" });
  });
});

describe("getVoiceSettingsForEmotion", () => {
  it("should return specific settings for known emotions", () => {
    const settings = getVoiceSettingsForEmotion("excited");
    expect(settings.stability).toBe(0.3);
    expect(settings.similarity_boost).toBe(0.7);
    expect(settings.style).toBe(0.8);
  });

  it("should return neutral settings for unknown emotion", () => {
    const settings = getVoiceSettingsForEmotion("unknown" as Emotion);
    expect(settings.stability).toBe(0.5);
    expect(settings.similarity_boost).toBe(0.75);
    expect(settings.style).toBe(0.0);
  });

  it("should have settings for all defined emotions", () => {
    for (const emotion of EMOTIONS) {
      const settings = getVoiceSettingsForEmotion(emotion);
      expect(settings).toHaveProperty("stability");
      expect(settings).toHaveProperty("similarity_boost");
      expect(settings).toHaveProperty("style");
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @jake/api test -- --testPathPattern=emotion.spec`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// emotion.ts
export const EMOTIONS = [
  "neutral", "happy", "encouraging", "empathetic", "excited",
  "curious", "playful", "proud", "thoughtful", "surprised",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
}

const EMOTION_VOICE_MAP: Record<Emotion, VoiceSettings> = {
  neutral:      { stability: 0.5,  similarity_boost: 0.75, style: 0.0 },
  happy:        { stability: 0.35, similarity_boost: 0.75, style: 0.6 },
  encouraging:  { stability: 0.4,  similarity_boost: 0.75, style: 0.5 },
  empathetic:   { stability: 0.55, similarity_boost: 0.8,  style: 0.3 },
  excited:      { stability: 0.3,  similarity_boost: 0.7,  style: 0.8 },
  curious:      { stability: 0.45, similarity_boost: 0.75, style: 0.4 },
  playful:      { stability: 0.35, similarity_boost: 0.7,  style: 0.7 },
  proud:        { stability: 0.35, similarity_boost: 0.75, style: 0.65 },
  thoughtful:   { stability: 0.55, similarity_boost: 0.8,  style: 0.2 },
  surprised:    { stability: 0.3,  similarity_boost: 0.7,  style: 0.7 },
};

const EMOTION_RE = /<emotion>(\w+)<\/emotion>/;

export function parseEmotion(text: string): { emotion: Emotion; text: string } {
  const match = EMOTION_RE.exec(text);
  if (!match) return { emotion: "neutral", text: text.trim() };

  const emotionName = match[1] as string;
  const isValid = EMOTIONS.includes(emotionName as Emotion);
  const cleanText = text.replace(EMOTION_RE, "").trim();

  return {
    emotion: isValid ? (emotionName as Emotion) : "neutral",
    text: cleanText,
  };
}

export function getVoiceSettingsForEmotion(emotion: Emotion): VoiceSettings {
  return EMOTION_VOICE_MAP[emotion] ?? EMOTION_VOICE_MAP.neutral;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @jake/api test -- --testPathPattern=emotion.spec`
Expected: PASS

**Step 5: Commit**

```
feat(emotion): add emotion parser and voice settings map
```

---

### Task 2: Add emotion instructions to system prompt

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/service/prompt-builder.ts` (lines 17-60, add emotion section after ACTIVE RECALL)
- Modify: `apps/api/src/@logic/lesson/application/service/prompt-builder.spec.ts`

**Step 1: Write the failing test**

Add to `prompt-builder.spec.ts`:

```typescript
it("should include emotion instructions with all 10 emotions", () => {
  const result = buildFullSystemPrompt(createMockContext());
  expect(result).toContain("=== EMOTIONAL EXPRESSION ===");
  expect(result).toContain("<emotion>");
  expect(result).toContain("neutral");
  expect(result).toContain("happy");
  expect(result).toContain("encouraging");
  expect(result).toContain("empathetic");
  expect(result).toContain("excited");
  expect(result).toContain("curious");
  expect(result).toContain("playful");
  expect(result).toContain("proud");
  expect(result).toContain("thoughtful");
  expect(result).toContain("surprised");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @jake/api test -- --testPathPattern=prompt-builder.spec`
Expected: FAIL — "EMOTIONAL EXPRESSION" not found

**Step 3: Add emotion instructions to JAKE_BASE_PROMPT**

Add the following block at the end of `JAKE_BASE_PROMPT` (after the ACTIVE RECALL section, before the closing backtick):

```
=== EMOTIONAL EXPRESSION ===
Express your emotional state by starting EVERY response with an <emotion> tag.
Available emotions: neutral, happy, encouraging, empathetic, excited, curious, playful, proud, thoughtful, surprised.

Format: <emotion>name</emotion>Your response text here.

Guidelines:
- neutral: default conversation, no strong emotion
- happy: student shares good news, pleasant topic
- encouraging: student is trying hard, making progress
- empathetic: student is tired, frustrated, or struggling
- excited: shared interest discovered, excellent answer
- curious: asking a question, wanting to know more about the student
- playful: joking, teasing, light banter
- proud: student nails something difficult, big improvement
- thoughtful: explaining grammar, giving advice, considering something
- surprised: unexpected answer, interesting fact from student

Rules:
- ALWAYS include exactly one <emotion> tag at the START of your response
- Match your text tone to the emotion — if you're excited, sound excited in your words too
- Don't overuse excited/happy — vary emotions naturally based on context
- Default to neutral when no strong emotion fits
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @jake/api test -- --testPathPattern=prompt-builder.spec`
Expected: PASS

**Step 5: Commit**

```
feat(emotion): add emotion instructions to tutor system prompt
```

---

### Task 3: Extract emotion in streaming pipeline and maintainer

**Files:**
- Modify: `apps/api/src/@logic/lesson/application/service/streaming-pipeline.service.ts`
- Modify: `apps/api/src/@logic/lesson/application/maintainer/lesson.maintainer.ts`

This task adds emotion extraction to the streaming path and the greeting.

**Step 1: Add onEmotion to StreamCallbacks**

In `streaming-pipeline.service.ts`, add to `StreamCallbacks` interface:

```typescript
export interface StreamCallbacks {
  onChunk(chunk: StreamChunk): void;
  onEnd(result: StreamResult): void;
  onError(error: Error): void;
  onDiscard?(safetyText: string): void;
  onSpeedChange?(speed: string): void;
  onEmotion?(emotion: string): void;  // NEW
}
```

**Step 2: Extract emotion from raw stream in StreamingPipelineService**

Modify the `stream()` method. Add an emotion extraction layer that watches the raw deltas for the `<emotion>...</emotion>` pattern before they reach the SentenceBuffer.

Add import at top:
```typescript
import { parseEmotion } from "./emotion";
```

Inside `stream()` method, add state tracking before `const sentenceBuffer`:
```typescript
let rawAccumulator = "";
let emotionExtracted = false;
```

Replace the existing `onText` callback with:
```typescript
onText: (delta) => {
  // Accumulate raw text to detect emotion tag before passing to sentence buffer
  if (!emotionExtracted) {
    rawAccumulator += delta;
    const closeIdx = rawAccumulator.indexOf("</emotion>");
    if (closeIdx !== -1) {
      // Full tag received — extract and strip
      const { emotion, text } = parseEmotion(rawAccumulator);
      emotionExtracted = true;
      callbacks.onEmotion?.(emotion);
      // Feed remaining text (after tag) into sentence buffer
      delta = text;
      rawAccumulator = "";
    } else if (rawAccumulator.length > 100 || !rawAccumulator.trimStart().startsWith("<")) {
      // No tag coming — flush accumulator as normal text
      emotionExtracted = true;
      callbacks.onEmotion?.("neutral");
      delta = rawAccumulator;
      rawAccumulator = "";
    } else {
      // Still accumulating, wait for more
      return;
    }
  }

  // Existing sentence buffer logic (unchanged)
  const sentences = sentenceBuffer.push(delta);

  for (const sentence of sentences) {
    emitChunk(sentence);
  }

  if (sentences.length > 0) {
    bufferStartTime = sentenceBuffer.hasContent() ? Date.now() : null;
  } else if (sentenceBuffer.hasContent() && bufferStartTime === null) {
    bufferStartTime = Date.now();
  }

  flushIfStale();
},
```

**Step 3: Handle emotion in LessonMaintainer greeting**

In `lesson.maintainer.ts`, add import:
```typescript
import { parseEmotion } from "../service/emotion";
```

In `startLesson()`, after `stripSpeedTags`:
```typescript
const { cleanText: greetingText, speed: greetingSpeed } = stripSpeedTags(greeting.text);
const { emotion: greetingEmotion, text: greetingCleanText } = parseEmotion(greetingText);
```

Use `greetingCleanText` instead of `greetingText` in `createWithGreeting` and the return object:
```typescript
const lesson = await this.lessonRepository.createWithGreeting(
  { userId, lessonNumber: context.lessonNumber },
  greetingCleanText,
);

return {
  lessonId: lesson.id,
  systemPrompt,
  voiceId: context.tutorVoiceId,
  speechSpeed,
  ttsModel: context.preferences.ttsModel,
  greeting: { text: greetingCleanText, emotion: greetingEmotion },
};
```

**Step 4: Strip emotion from chunks and fullText in processTextMessageStreaming**

In `processTextMessageStreaming()`, update the `onChunk` callback:
```typescript
onChunk: (chunk) => {
  const { cleanText } = stripSpeedTags(chunk.text);
  const { text: textWithoutEmotion } = parseEmotion(cleanText);
  if (textWithoutEmotion) {
    callbacks.onChunk({ ...chunk, text: textWithoutEmotion });
  }
},
```

In the `onEnd` callback, strip emotion from fullText:
```typescript
const { cleanText, speed } = stripSpeedTags(result.fullText);
const { text: finalText } = parseEmotion(cleanText);
// Use finalText instead of cleanText everywhere below
```

Wire `onEmotion` through:
```typescript
onEmotion: (emotion) => {
  callbacks.onEmotion?.(emotion);
},
```

**Step 5: Commit**

```
feat(emotion): extract emotion tags from Claude stream responses
```

---

### Task 4: Send emotion via WebSocket events to frontend

**Files:**
- Modify: `apps/api/src/@logic/lesson/presentation/gateway/lesson.gateway.ts`

**Step 1: Add emotion to lesson_started event**

In `handleConnection()`, add `emotion` to the `lesson_started` emit:
```typescript
client.emit("lesson_started", {
  lessonId: result.lessonId,
  voiceId: result.voiceId,
  speechSpeed: result.speechSpeed,
  ttsModel: result.ttsModel,
  systemPrompt: result.systemPrompt,
  emotion: result.greeting.emotion,
});
```

**Step 2: Add onEmotion callback in handleText()**

In `handleText()`, add `onEmotion` to the callbacks:
```typescript
onEmotion: (emotion) => {
  client.emit("tutor_emotion", { emotion, messageId });
},
```

**Step 3: Commit**

```
feat(emotion): send emotion events to frontend via WebSocket
```

---

### Task 5: Frontend — receive emotion and apply to ElevenLabs voice settings

**Files:**
- Modify: `apps/web/src/lib/config.ts`
- Modify: `apps/web/src/hooks/useTutorTts.ts`
- Modify: `apps/web/src/hooks/useLessonState.ts`

**Step 1: Add emotion voice settings map to config**

In `apps/web/src/lib/config.ts`, add after `TTS_CONFIG`:

```typescript
export const EMOTION_VOICE_SETTINGS: Record<string, { stability: number; similarity_boost: number; style: number }> = {
  neutral:      { stability: 0.5,  similarity_boost: 0.75, style: 0.0 },
  happy:        { stability: 0.35, similarity_boost: 0.75, style: 0.6 },
  encouraging:  { stability: 0.4,  similarity_boost: 0.75, style: 0.5 },
  empathetic:   { stability: 0.55, similarity_boost: 0.8,  style: 0.3 },
  excited:      { stability: 0.3,  similarity_boost: 0.7,  style: 0.8 },
  curious:      { stability: 0.45, similarity_boost: 0.75, style: 0.4 },
  playful:      { stability: 0.35, similarity_boost: 0.7,  style: 0.7 },
  proud:        { stability: 0.35, similarity_boost: 0.75, style: 0.65 },
  thoughtful:   { stability: 0.55, similarity_boost: 0.8,  style: 0.2 },
  surprised:    { stability: 0.3,  similarity_boost: 0.7,  style: 0.7 },
};
```

**Step 2: Modify useTutorTts to accept voice settings override**

In `useTutorTts.ts`:

Add `voiceSettings` parameter to `openWs` signature:
```typescript
async (voiceId: string, speechSpeed: number, onReady: () => void, model?: string, voiceSettings?: { stability: number; similarity_boost: number; style: number }) => {
```

In `ws.onopen`, use the passed settings:
```typescript
voice_settings: voiceSettings ?? TTS_CONFIG.VOICE_SETTINGS,
```

Update the `speak` function to accept and pass `voiceSettings`:
```typescript
const speak = useCallback(
  (text: string, voiceId: string, speechSpeed?: number, model?: string, voiceSettings?: { stability: number; similarity_boost: number; style: number }) => {
    if (!text.trim()) return;
    log("speak:", text.slice(0, 50), "voiceId:", voiceId);
    void openWs(voiceId, speechSpeed ?? 1.0, () => {
      sendTextToWs(text, true);
      sendEos();
    }, model, voiceSettings);
  },
  [openWs, sendTextToWs, sendEos],
);
```

Update `startStream` to accept `voiceSettings` and handle pre-warmed WS conflict:
```typescript
const startStream = useCallback(
  (voiceId: string, speechSpeed?: number, model?: string, voiceSettings?: { stability: number; similarity_boost: number; style: number }) => {
    log("startStream, voiceId:", voiceId);
    isStreamingRef.current = true;
    eosRequestedRef.current = false;

    // If voice settings provided, close pre-warmed WS (it has default settings)
    if (voiceSettings && (wsRef.current || connectingRef.current)) {
      log("startStream: closing pre-warmed WS for emotion-specific settings");
      closeWs();
    }

    if (wsRef.current || connectingRef.current) {
      log("startStream: reusing pre-warmed WS");
      return;
    }

    pendingTextRef.current = [];
    void openWs(voiceId, speechSpeed ?? 1.0, () => {}, model, voiceSettings);
  },
  [openWs, closeWs],
);
```

Update `UseTutorTtsReturn` interface and the return object accordingly.

**Step 3: Modify useLessonState to handle tutor_emotion event**

In `useLessonState.ts`:

Add import:
```typescript
import { EMOTION_VOICE_SETTINGS } from "@/lib/config";
```

Add ref:
```typescript
const emotionRef = useRef<string>("neutral");
```

In `handleEvent`, handle emotion from greeting:
```typescript
if (event === "lesson_started") {
  const d = data as LessonEventData & { voiceId?: string; speechSpeed?: number; ttsModel?: string; systemPrompt?: string; emotion?: string };
  // ... existing code ...
  if (d.emotion) emotionRef.current = d.emotion;
}
```

Handle `tutor_emotion` event (add before the `handleLessonEvent` call):
```typescript
if (event === "tutor_emotion") {
  const d = data as LessonEventData & { emotion?: string };
  if (d.emotion) emotionRef.current = d.emotion;
  return;
}
```

In `show_message` case, pass voice settings to `speak`:
```typescript
case "show_message": {
  if (action.text && voiceIdRef.current) {
    const voiceSettings = EMOTION_VOICE_SETTINGS[emotionRef.current] ?? EMOTION_VOICE_SETTINGS.neutral;
    pendingRevealTextRef.current = action.text;
    revealedLenRef.current = 0;
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, { role: "assistant" as const, text: "", timestamp: Date.now() }],
      status: "speaking",
    }));
    ttsRef.current.speak(action.text, voiceIdRef.current, speechSpeedRef.current, ttsModelRef.current, voiceSettings);
  }
  // ... else branch unchanged
  break;
}
```

In `stream_chunk` case, pass voice settings to `startStream`:
```typescript
if (!streamStartedRef.current && voiceIdRef.current) {
  streamStartedRef.current = true;
  const voiceSettings = EMOTION_VOICE_SETTINGS[emotionRef.current] ?? EMOTION_VOICE_SETTINGS.neutral;
  ttsRef.current.startStream(voiceIdRef.current, speechSpeedRef.current, ttsModelRef.current, voiceSettings);
}
```

Reset emotion on new user message in `sendText`:
```typescript
emotionRef.current = "neutral";
```

**Step 4: Commit**

```
feat(emotion): apply emotion-based voice settings to ElevenLabs TTS
```

---

### Task 6: Run all tests, lint, and type-check

**Step 1: Run API tests**

Run: `pnpm --filter @jake/api test`
Expected: PASS

**Step 2: Run lint and type-check**

Run: `pnpm lint && pnpm type-check`
Expected: PASS

**Step 3: Fix any issues found**

**Step 4: Final commit**

```
feat(emotion): tutor emotional expressiveness - complete
```

---

## Key Design Decisions

**Why extract emotion in StreamingPipelineService (not LessonMaintainer)?**
The emotion tag appears in the first few tokens of Claude's response. Extracting it in the streaming pipeline before the sentence buffer ensures the tag never leaks into chunks. The `onEmotion` callback fires before any `onChunk`, guaranteeing the frontend knows the emotion before starting TTS.

**Why close pre-warmed WS?**
ElevenLabs `voice_settings` can only be set in the BOS (beginning of stream) message. Pre-warm sends BOS with default settings. When emotion-specific settings are needed, the pre-warmed connection must be replaced. The latency cost (~200ms for token + WS open) is acceptable since the emotion tag detection takes a similar amount of time.

**Why one emotion per response (not per sentence)?**
Responses are typically 1-2 sentences. Per-sentence emotions would require multiple ElevenLabs connections or mid-stream reconfiguration (not supported). One emotion per response matches the natural conversational flow.
