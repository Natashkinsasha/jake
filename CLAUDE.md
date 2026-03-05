# Jake — English Tutor App

AI-powered English tutor with real-time voice lessons. Student speaks → Deepgram transcribes → Claude generates response → ElevenLabs synthesizes speech.

## Tech Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **API**: NestJS 10 (Fastify), Socket.IO 4, BullMQ
- **Web**: Next.js 14 (App Router), React 18, Tailwind CSS
- **DB**: PostgreSQL 16 (pgvector), Drizzle ORM
- **Queue**: BullMQ + Redis 7
- **Auth**: Google OAuth → NextAuth (web) → JWT (API)
- **AI**: Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- **TTS**: ElevenLabs (`eleven_turbo_v2_5`)
- **STT**: Deepgram (`nova-3`) — client-side WebSocket streaming
- **Embeddings**: OpenAI (`text-embedding-3-small`, 1536 dims)
- **Runtime**: Node.js 22 (Volta), pnpm 9.15

## Project Structure

```
jake/
├── apps/
│   ├── api/                    # NestJS backend (port 4000)
│   │   ├── src/
│   │   │   ├── @lib/           # Abstract providers & infra (provider, anthropic, deepgram, openai, job, job-board)
│   │   │   ├── @shared/        # NestJS infra modules (config, auth, db, redis, ws, job, cls, zod-http, anthropic, deepgram, openai)
│   │   │   ├── @logic/         # Domain modules (auth, health, lesson, llm, voice, embedding, memory, progress, tutor, vocabulary)
│   │   │   ├── main.ts         # API entry point
│   │   │   ├── worker.ts       # BullMQ worker entry point
│   │   │   ├── migrate.ts      # DB migrations runner
│   │   │   └── seed.ts         # Seed tutors
│   │   ├── drizzle/            # SQL migration files
│   │   └── Dockerfile
│   └── web/                    # Next.js frontend (port 3000)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (app)/      # Protected routes: dashboard, lessons
│       │   │   ├── (auth)/     # Login page
│       │   │   └── (lesson)/   # Live lesson page (voice interface)
│       │   ├── components/     # UI components
│       │   ├── hooks/          # Custom hooks (useWebSocket, useStudentStt, useAudioQueue, etc.)
│       │   ├── lib/            # Utils, auth config, API client
│       │   └── types/
│       └── Dockerfile
├── evals/                      # Prompt evaluation suite (promptfoo)
│   ├── datasets/               # Test datasets
│   ├── fixtures/               # Test fixtures
│   ├── prompts/                # Prompt templates
│   └── scripts/                # Eval helper scripts
├── packages/
│   └── shared/                 # Zod schemas shared between API and web
├── infra/
│   └── nginx.conf              # Production reverse proxy
├── docker-compose.yml          # Local dev (postgres + redis)
├── docker-compose.prod.yml     # Production (all services)
└── .github/workflows/          # CI/CD pipeline
```

## Local Development

```bash
docker compose up -d              # Start postgres + redis
pnpm install
cp .env.example .env              # Fill in API keys
pnpm db:migrate                   # Apply migrations
pnpm db:seed                      # Seed Jake tutor
pnpm dev                          # Start API (4000) + Web (3000)
```

Worker (optional, for background jobs):
```bash
pnpm --filter @jake/api start:worker
```

## Commands

```bash
pnpm dev                              # Dev servers (API + Web)
pnpm build                            # Build all
pnpm lint                             # Lint all
pnpm type-check                       # Type-check all
pnpm db:migrate                       # Apply DB migrations
pnpm db:seed                          # Seed tutors
pnpm --filter @jake/api db:generate   # Generate new migration
pnpm --filter @jake/api test          # API tests
pnpm --filter @jake/web test          # Web tests
pnpm --filter @jake/evals eval        # Run prompt evals
pnpm --filter @jake/evals eval:multi  # Run multi-turn evals
pnpm --filter @jake/evals eval:view   # View eval results
```

## API Architecture (DDD)

Each domain module in `@logic/` follows this structure:

```
@logic/<module>/
├── module.ts
├── presentation/
│   ├── controller/         # HTTP endpoints
│   └── gateway/            # WebSocket handlers
├── application/
│   ├── service/            # Business logic
│   ├── maintainer/         # Orchestrates services
│   └── dto/                # Data transfer objects
├── domain/
│   └── entity/             # Domain models
└── infrastructure/
    ├── repository/         # Data access (Drizzle)
    ├── table/              # Drizzle table definitions
    └── bull-handler/       # BullMQ job handlers
```

### Domain Modules

| Module         | Purpose                                                                              |
|----------------|--------------------------------------------------------------------------------------|
| **auth**       | Google OAuth, user management, JWT signing                                           |
| **lesson**     | Real-time voice lessons, WebSocket gateway, audio pipeline                           |
| **tutor**      | Tutor profiles (personality, voice, system prompt)                                   |
| **llm**        | AnthropicLlmProvider — `generate()`, `generateStream()`, `generateJson<T>()` w/ Zod. Includes `ModerationService` (regex + LLM safety filter, logged to Langfuse via `withSpan()`) |
| **voice**      | ElevenLabs TTS (`synthesize()`) + Deepgram STT (`transcribe()`)                     |
| **embedding**  | OpenAI embeddings (1536-dim vectors)                                                 |
| **memory**     | Two-tier memory: structured facts + vector embeddings                                |
| **vocabulary** | Data layer only (contract + repo). Written by post-lesson job, read by lesson context|
| **progress**   | Data layer only (contract + repo). Grammar topic scores (0-100), used by lesson context|
| **health**     | Health check endpoint                                                                |

### Library Modules (`@lib/`)

| Module         | Purpose                                                            |
|----------------|--------------------------------------------------------------------|
| **provider**   | Abstract base classes: `LlmProvider`, `TtsProvider`, `SttProvider`, `EmbeddingProvider` |
| **anthropic**  | Anthropic SDK client wrapper                                       |
| **deepgram**   | Deepgram SDK client wrapper                                        |
| **openai**     | OpenAI SDK client wrapper                                          |
| **job**        | BullMQ queue registration wrapper                                  |
| **job-board**  | Bull Board admin UI at `/admin/queues`                             |

### Infrastructure Modules (`@shared/`)

SharedConfigModule, SharedDrizzlePgModule, SharedRedisModule, SharedAuthModule, SharedJobModule, SharedWsModule, SharedClsModule, SharedZodHttpModule, SharedAnthropicModule, SharedDeepgramModule, SharedOpenaiModule.

**Convention**: No `@Global()` decorators — each module explicitly imports dependencies.

## Lesson Flow (WebSocket)

### Events

**Client → Server**: `text`, `audio`, `exercise_answer`, `set_speed`, `end_lesson`, `interrupt`

**Server → Client**: `lesson_started`, `tutor_message`, `tutor_chunk`, `tutor_stream_end`, `transcript`, `status`, `exercise_feedback`, `speed_updated`, `lesson_ended`, `error`

### Flow

1. Client connects with JWT in `auth.token` handshake
2. Server builds context: facts, memories, preferences, weak grammar topics
3. Claude generates greeting → ElevenLabs synthesizes → sent as `lesson_started`
4. User speaks → Deepgram (client-side) transcribes → `text` event sent
5. Regex pre-filter (instant) → flagged messages get `tutor_message` with safety response
6. LLM moderation (Haiku) runs in parallel with Sonnet streaming; chunks buffered until moderation resolves. If flagged → discard chunks, send safety response via `tutor_stream_end`
7. Streaming: Claude generates response → sentence buffer → TTS per sentence → `tutor_chunk` events → `tutor_stream_end` with full text
8. On disconnect/end → lesson saved to DB → `post-lesson` BullMQ job runs async (summary, vocabulary, progress, memory)

### Session

Redis-backed (TTL 2h). Stores: lessonId, systemPrompt, voiceId, speechSpeed, history[].

## STT (Client-Side Deepgram)

- Browser connects directly to `wss://api.deepgram.com/v1/listen`
- Token fetched from `/api/stt/token` (rate-limited 10/10min)
- Config: `nova-3`, `interim_results: true`, `endpointing: 300ms`, `vad_events: true`
- **Important**: `speech_final` events often have empty transcript. Use `is_final` segments via `onSegment` callback.

## Memory & Personalization

**Tier 1 — Facts**: Claude extracts structured facts from student messages (async BullMQ job). Categories: personal, preferences, goals, etc. Stored in `memory_facts`.

**Tier 2 — Embeddings**: Post-lesson emotional summary embedded via OpenAI. Stored in `memory_embeddings` (pgvector). Retrieved via cosine similarity (threshold > 0.3).

**Prompt Assembly**: Base personality → student profile → known facts (up to 30) → emotional context (top 5 vectors) → weak grammar topics → user preferences.

## Database

PostgreSQL 16 with pgvector. All tables use UUID PKs. Key tables:

- `users`, `user_preferences` — auth & settings
- `tutors`, `user_tutors` — tutor profiles
- `lessons`, `lesson_messages` — conversation history
- `memory_facts`, `memory_embeddings` — personalization
- `vocabulary` — words with spaced repetition
- `grammar_progress` — per-topic scores

Migrations in `drizzle/` folder, applied via `drizzle-kit`. In production: `docker compose run --rm api node dist/migrate.js`.

## Deployment

- **Host**: Vultr VPS (Frankfurt, 2 CPU / 4GB RAM)
- **Domain**: `jakestudy.xyz` (Porkbun → Vultr IP `192.248.177.48`)
- **SSL**: Let's Encrypt via certbot
- **Images**: `ghcr.io/natashkinsasha/jake-api`, `ghcr.io/natashkinsasha/jake-web`
- **CI/CD**: GitHub Actions — lint, test, build, push images, SSH deploy, health check, rollback on failure
- **Server path**: `/root/jake/` (.env, docker-compose.prod.yml, infra/nginx.conf)

### Nginx Routing

| Path | Target | Note |
|------|--------|------|
| `/api/auth/*` | web:3000 | NextAuth |
| `/api/stt/*` | web:3000 | Deepgram token |
| `/api/*` | api:4000 | NestJS REST |
| `/socket.io/*` | api:4000 | WebSocket (with upgrade) |
| `/*` | web:3000 | Next.js pages |

## Environment Variables

```
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://jake:jake@localhost:5432/jake
REDIS_URL=redis://localhost:6379
JWT_SECRET=<secret>
GOOGLE_CLIENT_ID=<from-google-cloud>
GOOGLE_CLIENT_SECRET=<from-google-cloud>
FRONTEND_URL=http://localhost:3000
ANTHROPIC_API_KEY=<key>
OPENAI_API_KEY=<key>
DEEPGRAM_API_KEY=<key>
ELEVENLABS_API_KEY=<key>
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=http://localhost:3000
LANGFUSE_PUBLIC_KEY=<key>
LANGFUSE_SECRET_KEY=<key>
LANGFUSE_BASE_URL=<url>
```

## Gotchas

1. **Next.js PORT conflict**: Root `.env` has `PORT=4000` for API. Next.js also reads `PORT`. Override `PORT=3000` in docker-compose for web service.
2. **BullMQ config**: `BullModule.forRootAsync()` needs `imports: [SharedConfigModule]` and Redis connection with `maxRetriesPerRequest: null`.
3. **drizzle-kit**: devDependency only — not in prod image. Run migrations via `node dist/migrate.js`.
4. **Deepgram `speech_final`**: Often has empty transcript. Use `is_final` with `onSegment`, not `speech_final`.
5. **WebSocket buffer**: Configured at 10MB (`maxHttpBufferSize`) for base64 audio chunks.
6. **Transactions**: Use `@Transactional()` decorator with CLS plugin for implicit propagation.
7. **.env symlink**: Root `.env` is symlinked to `apps/api/.env`.
