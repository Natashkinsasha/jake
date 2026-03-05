# Jake — AI English Tutor

Real-time voice-based English tutor powered by AI. Students have natural conversations with Jake, an Australian tutor persona, while the system tracks grammar progress, builds vocabulary, and remembers personal details across lessons.

> For detailed technical documentation (architecture, patterns, gotchas), see [CLAUDE.md](./CLAUDE.md).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | NestJS 10 (Fastify), Socket.IO 4 |
| Database | PostgreSQL 16 + pgvector |
| ORM | Drizzle ORM |
| Job Queue | BullMQ (Redis 7) |
| LLM | Anthropic Claude Sonnet 4 |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dims) |
| TTS | ElevenLabs `eleven_turbo_v2_5` |
| STT | Deepgram Nova-3 (client-side streaming) |
| Auth | Google OAuth via NextAuth → JWT |

## Monorepo Structure

```
jake/
├── apps/
│   ├── api/             # NestJS backend (REST + WebSocket, port 4000)
│   └── web/             # Next.js frontend (port 3000)
├── packages/
│   └── shared/          # Zod schemas shared between API and web
├── infra/
│   └── nginx.conf       # Production reverse proxy
├── docker-compose.yml        # Local dev (postgres + redis)
├── docker-compose.prod.yml   # Production (all services)
└── .github/workflows/        # CI/CD pipeline
```

## Local Development

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ (Volta pinned to 22.22.0) | `brew install node` or [volta.sh](https://volta.sh) |
| pnpm | 9.15.0 | `corepack enable && corepack prepare pnpm@9 --activate` |
| Docker | 24+ | [docker.com](https://docs.docker.com/get-docker/) |

### Setup

```bash
# 1. Start postgres + redis
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Create .env (see Environment Variables below)
cp .env.example .env

# 4. Apply migrations
pnpm db:migrate

# 5. Seed Jake tutor
pnpm db:seed

# 6. Start dev servers
pnpm dev
```

After `pnpm dev`:
- **Web**: http://localhost:3000
- **API**: http://localhost:4000

### BullMQ Worker (background jobs)

Background tasks (fact extraction, post-lesson summary, vocabulary and progress updates) run in a separate worker. Without it, lessons work but memory, vocabulary, and progress don't update.

```bash
pnpm --filter @jake/api start:worker
```

### Environment Variables

Create `.env` in the project root. API reads it directly (symlinked to `apps/api/.env`):

```bash
PORT=4000
NODE_ENV=development

# Database (matches docker-compose.yml)
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

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (type: Web application)
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID and Client Secret into `.env`

### Dev Proxy Routing

Nginx is not needed locally. Next.js proxies API requests via rewrites:

| Browser request | Proxied to |
|----------------|------------|
| `/api/auth/*` | Next.js (NextAuth) |
| `/api/stt/*` | Next.js (Deepgram token) |
| `/api/*` | `http://localhost:4000` (NestJS) |
| WebSocket | `http://localhost:4000` directly |

### Commands

```bash
pnpm dev                              # Start API + Web
pnpm build                            # Build all
pnpm lint                             # Lint all
pnpm type-check                       # Type-check all
pnpm db:migrate                       # Apply migrations
pnpm db:seed                          # Seed tutors
pnpm --filter @jake/api db:generate   # Generate new migration
pnpm --filter @jake/api start:worker  # Start BullMQ worker
pnpm --filter @jake/api test          # API tests
pnpm --filter @jake/web test          # Web tests
pnpm eval                             # LLM evals (single-turn)
pnpm eval:multi                       # LLM evals (multi-turn)
pnpm --filter @jake/evals generate-prompts  # Regenerate eval prompts from code
```

## How It Works

### Lesson Flow

```
┌──────────┐          ┌──────────┐          ┌──────────────┐
│  Browser  │◄──WS───►│  NestJS  │◄────────►│  PostgreSQL  │
│           │          │  Gateway │          │  + pgvector  │
└─────┬─────┘          └────┬─────┘          └──────────────┘
      │                     │
      │ Deepgram WS         │ Claude + ElevenLabs
      │ (client → Deepgram)  │ (server-side streaming)
      ▼                     ▼
┌──────────┐          ┌──────────┐
│ Deepgram │          │ External │
│  Nova-3  │          │  APIs    │
└──────────┘          └──────────┘
```

1. Client connects to `/ws/lesson` with JWT
2. Server builds context (student profile, memory, grammar progress)
3. Claude generates greeting → ElevenLabs synthesizes → `lesson_started` with text + base64 MP3
4. Client enables mic, streams audio to Deepgram via direct WebSocket
5. When Deepgram confirms a segment (`is_final`), client buffers it
6. After silence (`speech_final`), client sends accumulated text to server via `text` event
7. Server streams Claude response sentence-by-sentence, each sentence synthesized via ElevenLabs in parallel
8. Client receives ordered `stream_chunk` events (text + base64 MP3), enqueues audio, reveals text in sync with playback
9. If student speaks while tutor plays — audio queue stops, pending response is aborted

### TTS (Server-Side Streaming)

TTS runs **on the NestJS server** during lessons via `StreamingPipelineService`:
1. Claude streams text token-by-token
2. `SentenceBuffer` accumulates tokens into complete sentences
3. Each sentence is sent to ElevenLabs TTS **in parallel** (non-blocking)
4. Chunks are emitted to the client **in strict order** (shorter sentences don't skip ahead)
5. Client plays chunks sequentially via `useAudioQueue` hook

### STT (Client-Side Deepgram)

STT runs **in the browser** — no audio goes through the server:
1. Client fetches a short-lived Deepgram token from `GET /api/stt/token` (rate-limited 10/10min)
2. Opens WebSocket directly to `wss://api.deepgram.com/v1/listen` (Nova-3)
3. `MediaRecorder` captures mic audio (WebM/Opus) and sends 250ms chunks to Deepgram
4. Deepgram returns interim + final transcripts; `is_final` segments are buffered
5. On `speech_final` — all buffered segments are sent to NestJS as a single `text` event
6. **Gotcha**: `speech_final` often arrives with an empty transcript — actual text comes via `is_final` segments

### Memory System

Two-tier personalization:

**Tier 1 — Structured Facts**: Claude extracts facts from every message (async BullMQ job). Categories: personal, work, hobby, family, travel, education. Up to 30 active facts injected into prompt.

**Tier 2 — Semantic Embeddings**: Post-lesson emotional summary embedded via OpenAI (1536 dims). Stored in pgvector. At lesson start, cosine similarity search finds relevant memories (threshold > 0.3, top 5).

### Post-Lesson Processing

BullMQ job runs asynchronously after each lesson:
1. Claude summarizes conversation → topics, errors, vocabulary, CEFR assessment
2. User level updated if assessment changed
3. Emotional summary embedded and stored
4. New vocabulary added (strength 10, review in 24h)
5. Grammar progress updated (error topics -5 score)

All steps run in a DB transaction with 3 retries + exponential backoff.

### Provider Abstraction Layer

All external AI services are abstracted behind **abstract provider classes** using the **Strategy Pattern** and **Dependency Inversion Principle (DIP)**. Consumers depend on abstractions, not on vendor-specific implementations.

| Abstract class | Contract | Implementation |
|---------------|----------|----------------|
| `LlmProvider` | `generate()`, `generateJson<T>()` | `AnthropicLlmProvider` (Claude Sonnet 4) |
| `EmbeddingProvider` | `embed()` | `OpenAiEmbeddingProvider` (text-embedding-3-small) |
| `SttProvider` | `transcribe()` | `DeepgramSttProvider` (Nova-3) |
| `TtsProvider` | `synthesize()` | `ElevenLabsTtsProvider` (eleven_turbo_v2_5) |

Abstractions live in `@lib/provider/src/`, implementations in `@logic/` domain modules.

**Per-request resolution via CLS Proxy Providers**: Providers are registered through `ClsModule.forFeatureAsync()` from [nestjs-cls](https://papooch.github.io/nestjs-cls/). Under the hood, NestJS injects a **Proxy object** as a singleton, but every method call on this proxy is delegated to an instance bound to the current request's **CLS (Continuation-Local Storage)** context — an `AsyncLocalStorage`-backed request-scoped store.

```
Request lifecycle:
  1. Middleware (mount)    → Creates CLS context (AsyncLocalStorage.enterWith)
  2. Guards               → JWT auth, userId written to CLS
  3. Interceptor (resolve) → Resolves proxy providers via useFactory per-request
  4. Controller/Gateway    → Service calls llm.generate() → proxy → CLS lookup → concrete provider
```

CLS context is mounted **as early as possible** (middleware) and proxy providers are resolved **as late as possible** (interceptor, after guards). This means the factory has access to authenticated user data and can route to different implementations based on user experiments, feature flags, or A/B test groups.

```typescript
// Example: how a module registers a provider
ClsModule.forFeatureAsync({
  imports: [SharedAnthropicModule],
  provide: LlmProvider,                                    // DI token = abstract class
  inject: [AnthropicLlmProvider],
  useFactory: (anthropic: AnthropicLlmProvider) => anthropic, // can add routing logic here
})
```

## Deployment

### Infrastructure

| Component | Details |
|-----------|---------|
| Server | Vultr VPS, Frankfurt, `vc2-2c-4gb` (~$20/mo) |
| Domain | `jakestudy.xyz` (Porkbun, A-record → `192.248.177.48`) |
| SSL | Let's Encrypt via certbot |
| Registry | GitHub Container Registry (`ghcr.io`) |
| CI/CD | GitHub Actions (lint → test → build → deploy) |

### CI/CD Pipeline

Triggered on push to `main` or manual `workflow_dispatch`:

1. **checks** — lint + type-check
2. **test-api** / **test-web** — Jest tests (parallel)
3. **evals** — LLM prompt evals via promptfoo (runs only when `evals/` or `prompt-builder.ts` changed)
4. **build-api** / **build-web** — Docker build + push to ghcr.io
5. **deploy** — SSH to server → pull images → migrate → `up -d` → health check → rollback on failure

### Production Services (`docker-compose.prod.yml`)

| Service | Image | Purpose |
|---------|-------|---------|
| postgres | `pgvector/pgvector:pg16` | Database |
| redis | `redis:7-alpine` | Job queue + sessions |
| api | `ghcr.io/natashkinsasha/jake-api` | NestJS (port 4000) |
| worker | Same API image | BullMQ background jobs |
| web | `ghcr.io/natashkinsasha/jake-web` | Next.js (port 3000) |
| nginx | `nginx:alpine` | Reverse proxy + SSL |

### Nginx Routing

```
HTTP :80 → redirect to HTTPS
HTTPS :443:
  /api/auth/*    → web:3000   (NextAuth)
  /api/stt/*     → web:3000   (Deepgram token)
  /api/*         → api:4000   (NestJS REST)
  /socket.io/*   → api:4000   (WebSocket)
  /*             → web:3000   (Next.js)
```

### Manual Deploy

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
| `DROPLET_SSH_KEY` | Private SSH key |
| `GITHUB_TOKEN` | Auto-provided (ghcr.io login) |
| All env vars | Passed as secrets, written to `.env` on deploy |

## External Services

| Service | Model | Purpose |
|---------|-------|---------|
| Anthropic | Claude Sonnet 4 | Conversation, fact extraction, lesson summary |
| OpenAI | `text-embedding-3-small` | 1536-dim embeddings for semantic memory |
| ElevenLabs | `eleven_turbo_v2_5` | Text-to-speech (MP3) |
| Deepgram | Nova-3 | Real-time speech-to-text (client WebSocket) |

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
