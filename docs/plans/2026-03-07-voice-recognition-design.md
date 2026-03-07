# Voice Recognition: Detect Voice Changes Between Lessons

## Problem

Jake (the tutor) has no awareness of the student's voice characteristics. If a student sounds different (sick, tired, different mood), Jake can't notice or react naturally.

## Solution

Send a 10-second audio sample at lesson start. Extract voice embedding via Transformers.js. Compare with stored voiceprint. If voice differs, hint Claude to ask about it.

## Data Flow

1. Client starts recording (as usual for Deepgram STT)
2. In parallel, buffers first 10 seconds of raw audio
3. Sends `voice_sample` WebSocket event (one-time per lesson)
4. Server extracts embedding via Transformers.js (`pyannote/wespeaker-voxceleb-resnet34`, ~25MB ONNX)
5. If < 3 samples stored: save embedding, recalculate average voiceprint
6. If >= 3 samples stored: compare cosine similarity with averaged voiceprint
7. If similarity < threshold (0.75): add hint to lesson context for Claude

## New Table: `voice_prints`

| Column       | Type         | Notes                  |
|--------------|--------------|------------------------|
| id           | UUID         | PK                     |
| user_id      | UUID         | FK to users, unique    |
| embedding    | vector(256)  | Averaged voiceprint    |
| sample_count | integer      | Number of samples used |
| created_at   | timestamp    |                        |
| updated_at   | timestamp    |                        |

Vector dimension depends on actual model output (256 for wespeaker-resnet34).

## Changes by Layer

### Web (`apps/web`)

- `useStudentStt` hook: buffer first 10s of MediaRecorder chunks, send as `voice_sample` event via lesson WebSocket

### API Gateway

- `LessonGateway`: new `@SubscribeMessage("voice_sample")` handler, delegates to `VoicePrintService`

### API Service (new)

- `VoicePrintService`:
  - `processVoiceSample(userId, audioBuffer)`: extract embedding, store or compare
  - `extractEmbedding(audioBuffer)`: Transformers.js inference
  - `compareWithStored(userId, embedding)`: cosine similarity check
  - Returns `{ isMatch: boolean, similarity: number }` or `{ needsMoreSamples: true }`

### API Context

- `LessonContextService`: accept optional voice mismatch flag, add to system prompt: "The student's voice sounds different than usual - they may be sick or tired. You can gently ask about it."

### Database

- Migration: create `voice_prints` table with pgvector column

### Dependencies

- `@huggingface/transformers` added to `apps/api`

## Thresholds

- Cosine similarity < 0.75 = voice mismatch (tunable)
- First 3 lessons = enrollment only, no comparison
- Audio sample: 10 seconds, sent once at lesson start

## Economy

- Traffic: ~160KB per lesson (10s opus audio)
- Compute: single ONNX inference per lesson (~100-500ms)
- Storage: one 256-dim vector per user
- No continuous audio streaming to server
