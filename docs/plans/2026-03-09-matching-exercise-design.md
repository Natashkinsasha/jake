# Matching Exercise — Design

## Summary

In-lesson matching exercise: student connects words with their definitions via interactive UI cards. Tutor (Claude) decides when to offer exercises and can give hints when student asks.

## Data Format

Claude emits an XML tag inside the response:

```xml
Here, let's practice! Try matching these words with their definitions.
<exercise type="matching">
  <pair word="resilient" definition="able to recover quickly from difficulties"/>
  <pair word="reluctant" definition="unwilling and hesitant"/>
  <pair word="ambiguous" definition="open to more than one interpretation"/>
</exercise>
```

Rules:
- Tag comes AFTER introductory text (tutor voices the intro, exercise is visual only)
- 3-6 pairs: A1-A2 → 3, B1-B2 → 4-5, C1-C2 → 5-6
- Words from current conversation + student's vocabulary (for review)
- Definitions in English, adapted to student level

Student answer is added to Claude history as:
```
[Exercise result: 3/4 correct. Mistakes: "reluctant" → student matched with "open to more than one interpretation" (correct: "unwilling and hesitant")]
```

## Backend

### Tag Parsing

New `ExerciseTagExtractor` in streaming pipeline (same pattern as `VocabTagBuffer`):
- Buffers `<exercise>...</exercise>` tag from streaming chunks
- When complete — parses pairs, emits WebSocket event
- Text before the tag streams normally (TTS for intro)
- The tag itself is NOT sent to TTS

### WebSocket Events

Server → Client: `exercise`
```typescript
{
  exerciseId: string;       // uuid
  type: "matching";
  pairs: Array<{ word: string; definition: string }>;
}
```

Client → Server: `exercise_answer`
```typescript
{
  exerciseId: string;
  answers: Array<{ word: string; definition: string }>;
}
```

Server → Client: `exercise_feedback`
```typescript
{
  exerciseId: string;
  results: Array<{ word: string; correct: boolean; correctDefinition: string }>;
  score: string; // "3/4"
}
```

### Answer Validation

Backend compares pairs (not Claude) — instant feedback. After that, result is added to Claude history and tutor comments via voice.

### Session

Active exercise stored in Redis session: `activeExercise: { id, pairs }`.

## Frontend

### MatchingExercise Component

Appears in chat as a special message card:
- Two columns: words (left), definitions (right, shuffled)
- Student clicks word → clicks definition → pair connected (color/line)
- "Check" button to submit answer

### States
- `active` — student connecting pairs
- `submitted` — waiting for result
- `completed` — results shown (green ✓ / red ✗ per pair), collapses to compact "3/4 correct"

### Hints

No special UI — student speaks "give me a hint" / "подскажи" as normal voice input. Claude sees activeExercise in context and responds with a hint via voice.

### Integration

- New message type `exercise` in ChatHistory alongside `user`/`assistant`
- Voice input NOT blocked during exercise (student can ask hints, discuss words)

## System Prompt Rules

### When to offer:
- After explaining 3+ new words in conversation
- When student asks ("let's practice", "дай упражнение")
- Max 1 exercise per 10 messages
- Not during onboarding

### How to form pairs:
- Words from current conversation (priority)
- Fill from `vocabularyToReview` (spaced repetition words)
- Pair count by level: A1-A2 → 3, B1-B2 → 4-5, C1-C2 → 5-6
- Definitions in simple English, adapted to student level

### Hints:
- If student asks for hint and activeExercise exists — give hint (synonym, usage example, first letter of definition)
- Don't give direct answer, help approach it
- Multiple hints allowed, each more explicit

### After result:
- Comment: praise correct, explain mistakes
- Give usage examples for incorrect words
- Smoothly return to conversation

## Tracking

Phase 1 (now): Results saved as regular lesson messages only.
Phase 2 (later): Track per-word exercise results in DB for analytics.
