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

## Local Development

### 1. Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ (Volta pinned to 22.22.0) | `brew install node` or [volta.sh](https://volta.sh) |
| pnpm | 9.15.0 | `corepack enable && corepack prepare pnpm@9 --activate` |
| Docker | 24+ | [docker.com](https://docs.docker.com/get-docker/) |

### 2. Поднять базы данных

PostgreSQL (с pgvector) и Redis запускаются через Docker Compose:

```bash
docker compose up -d
```

Это поднимает:
- **PostgreSQL 16 + pgvector** на `localhost:5432` (user: `jake`, password: `jake`, db: `jake`)
- **Redis 7** на `localhost:6379`

Данные хранятся в Docker volumes (`pgdata`, `redisdata`) и переживают перезапуск контейнеров.

```bash
# проверить что работает
docker compose ps
docker compose logs postgres   # логи postgres
docker compose logs redis      # логи redis

# остановить
docker compose down

# остановить и удалить данные
docker compose down -v
```

### 3. Environment Variables

Создать `.env` в корне проекта. API читает его напрямую (symlink на `apps/api/.env`):

```bash
PORT=4000
NODE_ENV=development

# Database (совпадает с docker-compose.yml)
DATABASE_URL=postgres://jake:jake@localhost:5432/jake
POSTGRES_USER=jake
POSTGRES_PASSWORD=jake
POSTGRES_DB=jake

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=any-random-string-for-dev
NEXTAUTH_SECRET=any-random-string-for-dev
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# Frontend
FRONTEND_URL=http://localhost:3000

# AI
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Voice
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
```

### 4. Google OAuth (for login)

1. Зайти в [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (type: Web application)
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Скопировать Client ID и Client Secret в `.env`

### 5. Install & Run

```bash
# поднять PostgreSQL и Redis (если ещё не запущены)
docker compose up -d

# установить зависимости
pnpm install

# применить миграции (создаёт все таблицы + pgvector extension)
pnpm db:migrate

# засидить тьютора Jake в базу (нужно 1 раз)
pnpm db:seed

# запустить API + Web в dev-режиме
pnpm dev
```

После `pnpm dev`:
- **Web**: http://localhost:3000
- **API**: http://localhost:4000

### 6. BullMQ Worker (background jobs)

`pnpm dev` запускает только API и Web. Background-задачи (извлечение фактов из разговора, пост-обработка урока, обновление прогресса) обрабатывает отдельный воркер. Без него уроки работают, но память и прогресс не обновляются.

```bash
# в отдельном терминале
pnpm --filter @jake/api start:worker
```

### Как работает проксирование в dev

Nginx не нужен локально. Next.js проксирует запросы к API через rewrites (`apps/web/next.config.js`):

| Запрос в браузере | Куда проксируется |
|-------------------|-------------------|
| `/api/auth/*` | Остаётся в Next.js (NextAuth) |
| `/api/stt/*` | Остаётся в Next.js (Deepgram token) |
| `/api/*` (всё остальное) | `http://localhost:4000/*` (NestJS) |
| WebSocket (Socket.IO) | `http://localhost:4000` напрямую (Next.js rewrites не поддерживают WS) |

> **Note:** WebSocket подключается напрямую к порту 4000, минуя Next.js. CSP автоматически добавляет `ws://localhost:4000` в dev-режиме. В production WebSocket идёт через nginx на том же домене.

### Полезные команды

```bash
pnpm dev                              # запустить всё
pnpm build                            # собрать оба приложения
pnpm lint                             # линтинг
pnpm type-check                       # проверка типов
pnpm db:migrate                       # применить миграции
pnpm db:seed                          # засидить данные
pnpm --filter @jake/api db:generate   # сгенерировать миграцию после изменения схемы
pnpm --filter @jake/api start:worker  # запустить BullMQ воркер
pnpm --filter @jake/api test          # тесты API
pnpm --filter @jake/web test          # тесты Web
```

---

## Deployment

### Infrastructure

| Component | Details |
|-----------|---------|
| Server | Vultr VPS, Frankfurt, `vc2-2c-4gb` |
| Domain | `jakestudy.xyz` (Porkbun, A-record → `192.248.177.48`) |
| SSL | Let's Encrypt via certbot |
| Registry | GitHub Container Registry (`ghcr.io`) |

### CI/CD Pipeline

Deployment is fully automated via GitHub Actions (`.github/workflows/deploy.yml`):

```
Push to main
    │
    ├──────────────────────────────────┐
    ▼                ▼                 ▼
┌─────────┐   ┌──────────┐   ┌──────────┐
│ checks  │   │ test-api │   │ test-web │
│ lint +  │   │          │   │          │
│ typecheck│   │          │   │          │
└────┬────┘   └────┬─────┘   └────┬─────┘
     │             │              │
     ├─────┬───────┘              │
     │     │    ┌─────────────────┘
     ▼     ▼    ▼     ▼
┌───────────┐ ┌───────────┐
│ build-api │ │ build-web │
│ → ghcr.io │ │ → ghcr.io │
└─────┬─────┘ └─────┬─────┘
      └──────┬───────┘
             ▼
┌──────────────────────────────┐
│  deploy (SSH to Vultr)       │
│  pull → up -d → restart nginx│
└──────────────────────────────┘
```

**Trigger**: push to `main` or manual `workflow_dispatch`.

`build-api` зависит от `checks` + `test-api` (не от `test-web`), и наоборот — билды не блокируют друг друга.

### Production Compose (`docker-compose.prod.yml`)

Services:

| Service | Image | Purpose |
|---------|-------|---------|
| `postgres` | `pgvector/pgvector:pg16` | Database with vector extension |
| `redis` | `redis:7-alpine` | BullMQ job queue |
| `api` | `ghcr.io/natashkinsasha/jake-api` | NestJS API (port 4000) |
| `worker` | Same API image, `node dist/worker.js` | BullMQ background jobs |
| `web` | `ghcr.io/natashkinsasha/jake-web` | Next.js frontend (port 3000) |
| `nginx` | `nginx:alpine` | Reverse proxy, SSL termination |

### Nginx Routing (`infra/nginx.conf`)

```
HTTP :80 → redirect to HTTPS
HTTPS :443:
  /api/auth/*    → web:3000   (NextAuth handles OAuth)
  /api/stt/*     → web:3000   (Deepgram token endpoint)
  /api/*         → api:4000   (NestJS REST API)
  /socket.io/*   → api:4000   (WebSocket, with upgrade headers)
  /*             → web:3000   (Next.js pages)
```

### Docker Images

Both images use multi-stage builds (`node:20-alpine`):

- **API** (`apps/api/Dockerfile`): builds `@jake/shared` → builds `@jake/api` → `pnpm deploy --prod` for minimal `node_modules` → final image has only `dist/` and dependencies.
- **Web** (`apps/web/Dockerfile`): builds `@jake/shared` → builds `@jake/web` → copies Next.js `standalone` output → final image runs `node apps/web/server.js`.

Both builds use GitHub Actions cache (`type=gha`) for Docker layers. Root `.dockerignore` excludes `node_modules`, `.git`, `.next`, `dist` from build context.

### Server Setup

Files on the server (`/root/jake/`):

```
/root/jake/
├── .env                       # production env vars (manual)
├── docker-compose.prod.yml    # copied from repo
└── infra/
    └── nginx.conf             # copied from repo
```

### Known Gotchas

- **Next.js PORT**: The `.env` has `PORT=4000` (for API), but Next.js standalone also reads `PORT`. In `docker-compose.prod.yml`, the `web` service overrides it with `PORT: 3000`.
- **NextAuth routing**: `/api/auth/*` must proxy to the web container, not API. NextAuth runs inside Next.js.
- **DB migrations**: `drizzle-kit` is a devDependency and not included in production images. Run migrations manually via `psql` on the server or use a one-off container.
- **SSL certificates**: Managed by certbot. Volumes `certbot-webroot` and `letsencrypt` are shared with nginx. The ACME challenge path `/.well-known/acme-challenge/` is served from the webroot.
- **WebSocket timeout**: Nginx has `proxy_read_timeout 86400s` for `/socket.io/` to keep long-lived lesson connections alive.

### Manual Deploy (without CI)

```bash
ssh root@192.248.177.48
cd /root/jake
docker compose -f docker-compose.prod.yml pull api web
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml restart nginx
docker image prune -f
```

### GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `DROPLET_HOST` | Server IP |
| `DROPLET_SSH_KEY` | Private SSH key for deploy |
| `GITHUB_TOKEN` | Auto-provided, used for ghcr.io login |

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
- **Token:** Fetched from `/api/stt/token` (tries Deepgram grant API for short-lived token, falls back to API key). Protected by auth + rate limit (10 req / 10 min).

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

## Reliability & Observability

- **Logging**: All external API calls (Anthropic, ElevenLabs, Deepgram, OpenAI) have structured logging with NestJS `Logger` — request params, response stats, errors with stack traces.
- **Graceful degradation**: If TTS fails, the tutor message is sent as text-only (no audio). The lesson continues without interruption.
- **Zod validation**: LLM JSON responses are validated with Zod schemas (`safeParse`). Invalid responses are logged with raw output for debugging.
- **Transactions**: Post-lesson processing (summary, level update, vocabulary, grammar, embeddings) runs in a single DB transaction.
- **Retry**: Anthropic SDK uses `maxRetries: 2`. ElevenLabs and Deepgram have 1 retry on server errors. Bull jobs retry 3 times with exponential backoff.
- **Session state**: WebSocket lesson sessions stored in Redis (TTL: 2 hours) instead of in-memory Map. Survives server restarts.
- **Connection pooling**: PostgreSQL pool size: 10 connections.

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

1. **Lesson summary** — Claude analyzes the full conversation → summary, topics covered, new words, errors found, CEFR level assessment. Response validated with Zod schema.
2. **User level update** — if level assessment differs, update `users.current_level`
3. **Emotional embedding** — summary embedded and stored for future semantic retrieval
4. **Vocabulary** — new words added with initial strength 10, review in 24 hours
5. **Grammar progress** — error topics get level decremented by 5; grammar scores drive `=== LEARNING FOCUS ===` in future prompts

Steps 1-5 (except homework generation) run inside a **database transaction** — if any step fails, all changes are rolled back. Jobs are configured with retry (3 attempts, exponential backoff).

---

## External Services

| Service | Model | Purpose |
|---------|-------|---------|
| Anthropic | Claude Sonnet 4 | Conversation, fact extraction, lesson summary |
| OpenAI | `text-embedding-3-small` | 1536-dim embeddings for semantic memory |
| ElevenLabs | `eleven_turbo_v2_5` | Text-to-speech (MP3 streaming) |
| Deepgram | Nova-3 | Real-time speech-to-text (client WebSocket) |
| PostgreSQL | + pgvector | Database with vector similarity search |
| Redis | — | BullMQ job queue + WebSocket session storage |
