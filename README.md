# Jake — AI English Tutor

Real-time voice-based English tutor powered by AI. Students have natural conversations with Jake, an Australian tutor persona, while the system tracks grammar progress, builds vocabulary, and remembers personal details across lessons.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | NestJS (Fastify), Socket.IO |
| Database | PostgreSQL + pgvector extension |
| ORM | Drizzle ORM |
| Job Queue | BullMQ (Redis) |
| LLM | Anthropic Claude Sonnet 4 |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dims) |
| TTS | ElevenLabs `eleven_turbo_v2_5` |
| STT | Deepgram Nova-3 (client-side streaming) |
| Auth | Google OAuth via NextAuth |

## Monorepo Structure

```
jake/
├── apps/
│   ├── api/          # NestJS backend (REST + WebSocket)
│   └── web/          # Next.js frontend
├── packages/
│   └── shared/       # Zod schemas shared between API and web
├── turbo.json        # Turborepo pipeline
└── pnpm-workspace.yaml
```

## Getting Started

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev            # starts both API (port 4000) and web (port 3000)
```

### Environment Variables (API)

```
DATABASE_URL=postgres://...
REDIS_URL=redis://localhost:6379
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FRONTEND_URL=http://localhost:3000
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
```

## Architecture Overview

### Auth Flow

1. User signs in with Google (NextAuth handles OAuth)
2. Frontend POSTs `{ googleId, email, name }` to `POST /auth/google`
3. Backend finds or creates user, signs JWT `{ sub: userId }`
4. JWT stored in session and `localStorage` for API/WebSocket auth

### Lesson Flow (Real-Time Voice)

The core feature is a real-time voice conversation over WebSocket (Socket.IO):

```
┌──────────┐          ┌──────────┐          ┌──────────────┐
│  Browser  │◄──WS───►│  NestJS  │◄────────►│  PostgreSQL  │
│           │          │  Gateway │          │  + pgvector  │
└─────┬─────┘          └────┬─────┘          └──────────────┘
      │                     │
      │ Deepgram WS         │ Anthropic Claude
      │ (STT streaming)     │ ElevenLabs TTS
      ▼                     ▼
┌──────────┐          ┌──────────┐
│ Deepgram │          │ External │
│  Nova-3  │          │  APIs    │
└──────────┘          └──────────┘
```

**Connection sequence:**

1. Client connects to `/ws/lesson` with JWT
2. Server builds lesson context (student profile, memory, grammar progress)
3. Server generates greeting via Claude + TTS → sends `tutor_message` with text + base64 MP3
4. Client enables microphone, streams audio chunks to Deepgram via direct WebSocket
5. When Deepgram confirms a final segment (`is_final`), client buffers it
6. After 1 second of silence, client sends accumulated text to server via `text` event
7. Server generates response (Claude) + synthesizes audio (ElevenLabs) → `tutor_message`
8. Loop continues until lesson ends

**Interruption:** If the student starts speaking while the tutor is playing audio, the client immediately stops playback and cancels any pending tutor response.

**WebSocket events:**

| Client → Server | Purpose |
|----------------|---------|
| `text` | Transcribed user speech |
| `exercise_answer` | Answer to interactive exercise |
| `end_lesson` | Student ends the lesson |

| Server → Client | Purpose |
|----------------|---------|
| `lesson_started` | Lesson ID |
| `tutor_message` | Text + audio (base64 MP3) + optional exercise |
| `transcript` | Echo of user's text |
| `status` | `{ state: "thinking" }` |
| `lesson_ended` | Lesson complete |

### Client-Side STT (Deepgram Streaming)

The browser connects directly to Deepgram's WebSocket API (`wss://api.deepgram.com/v1/listen`):

- **Model:** Nova-3
- **Endpointing:** 300ms (detects end of utterance)
- **VAD events:** Enabled (speech start/end detection)
- **Audio format:** `MediaRecorder` sends 250ms chunks (WebM/Opus)
- **Token:** Fetched from `/api/stt/token` (passes through `DEEPGRAM_API_KEY`)

Key events from Deepgram:
- `SpeechStarted` → user began speaking (used to interrupt tutor)
- `Results` with `is_final: true` → confirmed transcript segment
- `Results` with `speech_final: true` → utterance complete

### Tutor Persona

Jake's personality is defined in `prompt-builder.ts`. The system prompt is assembled from:

1. **Base personality** — Australian, laid-back, funny, keeps responses to 1-2 sentences
2. **Student profile** — name, CEFR level, lesson number
3. **Preferences** — correction style (immediate/end_of_lesson/natural), grammar explanations, speaking speed
4. **Known facts** — personal details remembered from past conversations
5. **Emotional context** — semantically retrieved memories relevant to current topic
6. **Learning focus** — weak/strong grammar areas, recent vocabulary, suggested topic

Interactive exercises are embedded in LLM responses using `<exercise>{JSON}</exercise>` tags, parsed and rendered as cards in the chat UI.

---

## Memory System

The memory system is the key to making Jake feel like a real tutor who remembers the student across lessons. It has two tiers:

### Tier 1: Structured Facts (`memory_facts`)

Short categorized statements extracted from every conversation turn.

```
┌─────────────────────────────────────────────────────┐
│ memory_facts                                        │
├─────────────────────────────────────────────────────┤
│ id          uuid  PK                                │
│ user_id     uuid  FK → users                        │
│ category    varchar(50)  (personal/work/hobby/...)   │
│ fact        text         "Works as a designer"       │
│ source      varchar(255) lesson ID that produced it  │
│ is_active   boolean                                  │
│ created_at  timestamp                                │
│ updated_at  timestamp                                │
└─────────────────────────────────────────────────────┘
```

**Categories:** `personal`, `work`, `hobby`, `family`, `travel`, `education`, `other`

**Extraction pipeline:**

1. Student sends a message during the lesson
2. Server queues a `fact-extraction` BullMQ job with `{ userId, lessonId, userMessage, history }`
3. `FactExtractionBullHandler` processes the job asynchronously
4. `FactExtractionService` sends conversation context to Claude with a structured prompt:
   ```
   Analyze the student's message in context.
   Extract NEW personal facts, errors, mood, and level signals.
   Return JSON: { facts: [{category, fact}], errors: [...], mood: "...", levelSignals: "..." }
   ```
5. Each extracted fact is saved to `memory_facts` with `source = lessonId`

**Usage:** At lesson start, up to **30 active facts** are loaded and injected into the system prompt under `=== KNOWN FACTS ===`.

### Tier 2: Semantic Embeddings (`memory_embeddings`)

Vector embeddings of emotional/contextual summaries, enabling semantic retrieval of relevant memories.

```
┌─────────────────────────────────────────────────────┐
│ memory_embeddings                                   │
├─────────────────────────────────────────────────────┤
│ id              uuid  PK                            │
│ user_id         uuid  FK → users                    │
│ lesson_id       uuid  FK → lessons                  │
│ content         text  "Student was excited about    │
│                        their trip to Melbourne"      │
│ embedding       vector(1536)  pgvector column        │
│ emotional_tone  varchar(20)                          │
│ created_at      timestamp                            │
└─────────────────────────────────────────────────────┘
```

**How embeddings are created:**

1. After a lesson ends, `PostLessonBullHandler` runs
2. Claude generates an `emotionalSummary` from the full conversation
3. The summary is embedded via OpenAI `text-embedding-3-small` → 1536-dimensional vector
4. Stored in `memory_embeddings` with the vector in a pgvector `vector(1536)` column

**Semantic search (cosine similarity):**

At lesson start, `MemoryRetrievalService` searches for memories relevant to the suggested topic:

```sql
SELECT id, content, emotional_tone, created_at,
       1 - (embedding <=> $queryVector::vector) AS similarity
FROM memory_embeddings
WHERE user_id = $userId
  AND embedding IS NOT NULL
  AND 1 - (embedding <=> $queryVector::vector) > 0.3   -- threshold
ORDER BY similarity DESC
LIMIT 5
```

- `<=>` is pgvector's **cosine distance** operator
- Similarity = `1 - cosine_distance` (range 0 to 1)
- Only memories with similarity > **0.3** are returned
- Top **5** results are injected into the system prompt as `=== EMOTIONAL CONTEXT ===`

**Example flow:**

```
Lesson 1: Student mentions they love surfing in Bali
  → Fact extracted: {category: "hobby", fact: "Loves surfing, has been to Bali"}
  → Post-lesson summary: "Student was enthusiastic about travel and surfing"
  → Embedded as vector and stored

Lesson 5: Suggested topic is "travel vocabulary"
  → Query "travel vocabulary" is embedded
  → Cosine search finds the Bali surfing memory (similarity: 0.72)
  → Jake's prompt includes: "Student was enthusiastic about travel and surfing"
  → Jake naturally references: "Hey mate, last time you mentioned Bali — reckon we could chat about travel vocab today?"
```

### How Both Tiers Work Together

```
Lesson Start
    │
    ├── Load structured facts (up to 30)     → "=== KNOWN FACTS ==="
    │   "Works as a designer"
    │   "Has a dog named Rex"
    │   "Visited London last summer"
    │
    └── Semantic search for relevant          → "=== EMOTIONAL CONTEXT ==="
        emotional summaries (top 5)
        "Was frustrated with past tense last lesson (similarity: 0.85)"
        "Excited about upcoming trip to Japan (similarity: 0.71)"

During Lesson
    │
    └── Every user message → async fact extraction job
        "I got a new job at a startup"
        → {category: "work", fact: "Recently started working at a startup"}

Lesson End
    │
    └── Post-lesson job:
        1. Generate emotional summary → embed → store
        2. Update vocabulary strength
        3. Update grammar progress scores
```

---

## Database Schema

```
users ──< user_preferences (1:1)
users ──< user_tutors >── tutors
users ──< lessons >── tutors
lessons ──< lesson_messages
users ──< memory_facts
users ──< memory_embeddings ──< lessons
users ──< grammar_progress
users ──< vocabulary ──< lessons
```

Key tables:

| Table | Purpose |
|-------|---------|
| `users` | Google OAuth profile, CEFR level |
| `user_preferences` | Correction style, interests, exercise preferences |
| `tutors` | Tutor personality, voice ID, system prompt |
| `lessons` | Lesson metadata, summary, topics, errors found |
| `lesson_messages` | Full conversation history (role + content) |
| `memory_facts` | Structured personal facts per student |
| `memory_embeddings` | 1536-dim vectors for semantic memory retrieval |
| `grammar_progress` | Per-topic score (0-100), error/success counts |
| `vocabulary` | Words learned, spaced repetition strength + next review date |

---

## Post-Lesson Processing

When a lesson ends, a `post-lesson` BullMQ job runs asynchronously:

1. **Lesson summary** — Claude analyzes the full conversation → summary, topics covered, new words, errors found, CEFR level assessment
2. **User level update** — if level assessment differs, update `users.current_level`
3. **Emotional embedding** — summary embedded and stored for future semantic retrieval
4. **Vocabulary** — new words added with initial strength 10, review in 24 hours
5. **Grammar progress** — error topics get level decremented by 5; grammar scores drive `=== LEARNING FOCUS ===` in future prompts

---

## External Services

| Service | Model | Purpose |
|---------|-------|---------|
| Anthropic | Claude Sonnet 4 | Conversation, fact extraction, lesson summary |
| OpenAI | `text-embedding-3-small` | 1536-dim embeddings for semantic memory |
| ElevenLabs | `eleven_turbo_v2_5` | Text-to-speech (MP3 streaming) |
| Deepgram | Nova-3 | Real-time speech-to-text (client WebSocket) |
| PostgreSQL | + pgvector | Database with vector similarity search |
| Redis | — | BullMQ job queue backing store |
