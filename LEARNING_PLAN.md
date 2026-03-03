# AI Infrastructure Learning Plan

> Принцип: каждый пункт — 1-2 дня максимум, делаем MVP, не идеал. Порядок выстроен по зависимостям.
> Итого: ~20 дней.

---

## Фаза 1: Фундамент (4 дня)

### День 1-2: Observability + Cost Tracking

**Цель:** Обёртка над LLM вызовами с полным логированием.

**Задачи:**

- [ ] Добавить в `@lib/llm` middleware: логирование prompt, completion, tokens (input/output), latency
- [ ] Считать cost per request (Claude pricing: input/output tokens x rate)
- [ ] Создать таблицу `llm_logs` (userId, model, tokens_in, tokens_out, cost, latency_ms, timestamp)
- [ ] Endpoint `/api/admin/llm-stats` — расход по юзерам, за день/неделю
- [ ] **Бонус:** подключить Langfuse (self-hosted через docker) — 2 часа, красивый UI

**Навыки:** token accounting, observability patterns, cost management

---

### День 3-4: Model Routing Abstraction

**Цель:** Абстракция провайдера LLM с dynamic routing и fallback.

**Задачи:**

- [ ] Интерфейс `LlmProvider` с методами `generate()`, `generateJson()`
- [ ] Реализации: `AnthropicProvider`, `OpenAiProvider`
- [ ] Config: `MODEL_PROVIDER=anthropic|openai`
- [ ] Dynamic routing: дешёвая модель (Haiku) для summary/facts extraction, дорогая (Sonnet) для диалога
- [ ] Fallback: если основной провайдер 5xx — переключиться на запасной

**Навыки:** strategy pattern для LLM, graceful degradation, multi-model architecture

---

## Фаза 2: Качество (4 дня)

### День 5-6: Evaluation Pipeline

**Цель:** LLM-as-judge — автоматическая оценка качества уроков.

**Задачи:**

- [ ] BullMQ job `evaluate-lesson` (после `post-lesson`)
- [ ] Judge prompt: оценить по rubric (grammar correction accuracy, conversation flow, topic relevance, student engagement) — structured JSON score 0-100
- [ ] Таблица `lesson_evaluations` (lessonId, scores JSON, judge_model, created_at)
- [ ] Использовать дешёвую модель (Haiku) как judge
- [ ] Endpoint: `/api/lessons/:id/evaluation`

**Навыки:** LLM evaluation, rubric design, quality measurement

---

### День 7-8: Prompt Injection Protection + Safety

**Цель:** Input/output guardrails для безопасности.

**Задачи:**

- [ ] Input guard: проверять user message на prompt injection паттерны (regex + LLM classifier)
- [ ] Output guard: проверять ответ тьютора на toxicity/off-topic
- [ ] Простой classifier через Haiku: `is_safe: boolean, reason: string`
- [ ] Moderation middleware в WebSocket gateway — до отправки в Claude
- [ ] Логировать flagged messages в `moderation_logs`

**Навыки:** AI safety, guardrails, content moderation pipeline

---

## Фаза 3: Memory & Retrieval (2 дня)

### День 9-10: Hybrid Search + Time Decay

**Цель:** Улучшить memory retrieval — hybrid search, time decay, emotion-aware.

**Задачи:**

- [ ] **BM25:** добавить `tsvector` колонку в `memory_facts`, PostgreSQL full-text search
- [ ] **Hybrid:** `score = 0.7 * vector_similarity + 0.3 * bm25_score` (нормализованные)
- [ ] **Time decay:** `final_score = score * decay_factor(days_since_created)` — экспоненциальный decay
- [ ] **Emotion retrieval:** если предыдущее сообщение содержит frustration/confusion — подтянуть эмоционально похожие воспоминания

**Навыки:** hybrid retrieval, ranking algorithms, time-aware search

---

## Фаза 4: Real-time (3 дня)

### День 11-12: Streaming Response + Voice Optimization

**Цель:** Streaming Claude — chunked TTS для минимальной задержки.

**Задачи:**

- [ ] Claude streaming API — собирать текст по предложениям
- [ ] Как только предложение готово — отправить в ElevenLabs — стримить audio chunk клиенту
- [ ] Клиент: audio queue — играть chunks последовательно
- [ ] Результат: первый звук через ~1с вместо ~3-5с

**Навыки:** streaming pipelines, real-time audio, chunked processing

---

### День 13: Interruptible Generation

**Цель:** Прерывание генерации когда юзер начинает говорить.

**Задачи:**

- [ ] Если юзер начал говорить — abort текущий Claude request + остановить TTS
- [ ] AbortController на Claude API call
- [ ] WebSocket event `user_speaking` — cancel pipeline

**Навыки:** abort patterns, real-time UX, pipeline cancellation

---

## Фаза 5: Adaptive Learning (2 дня)

### День 14-15: Curriculum State Machine

**Цель:** FSM для прогресса студента — граф грамматических тем с зависимостями.

**Задачи:**

- [ ] Граф грамматических тем с зависимостями (JSON config):
  ```
  Present Simple -> Present Continuous -> Past Simple -> Present Perfect -> ...
  ```
- [ ] Состояния узла: `locked | available | in_progress | mastered`
- [ ] После каждого урока evaluation обновляет scores — разблокирует следующие темы
- [ ] Тьютор получает в контексте: "focus on these topics, student is ready for X"

**Навыки:** FSM, adaptive learning, skill graphs

---

## Фаза 6: Advanced (3 дня)

### День 16-17: Self-hosted LLM (Ollama)

**Цель:** Попробовать локальную модель, сравнить с Claude.

**Задачи:**

- [ ] Установить Ollama, скачать `llama3.1:8b` или `mistral`
- [ ] Добавить `OllamaProvider` в model routing
- [ ] Сравнить: latency, quality (через evaluation pipeline!), cost ($0)
- [ ] Feature flag: `MODEL_PROVIDER=ollama` для dev/testing

**Навыки:** self-hosted inference, model comparison, local LLM ops

---

### День 18: Multi-Agent Architecture

**Цель:** Разделить монолитный LLM вызов на специализированных агентов.

**Задачи:**

- [ ] Разделить: ConversationAgent, MemoryAgent, GrammarAgent
- [ ] Orchestrator выбирает какие agents вызвать
- [ ] Tool calling: GrammarAgent может вызвать `check_grammar` tool
- [ ] Рефакторинг lesson flow в agent pipeline

**Навыки:** multi-agent systems, tool calling, orchestration

---

## Фаза 7: Analytics (2 дня)

### День 19-20: Метрики + Dashboard + A/B

**Цель:** Собрать всё вместе — метрики, аналитика, A/B тесты.

**Задачи:**

- [ ] Метрики: lesson completion %, speaking time ratio, interruption rate, avg evaluation score, cost per lesson
- [ ] Страница `/admin/analytics` (или JSON endpoints)
- [ ] A/B: feature flag для persona tone (strict vs friendly) — сравнить evaluation scores

**Навыки:** AI product metrics, A/B testing, data-driven decisions

---

## Сводная таблица

| Фаза | Дни | Что в резюме |
|------|-----|-------------|
| Observability + Cost | 1-4 | LLM observability, token accounting, cost optimization |
| Evaluation + Safety | 5-8 | LLM evaluation pipeline, AI safety guardrails |
| Hybrid Retrieval | 9-10 | Hybrid search (BM25 + vector), RAG optimization |
| Streaming | 11-13 | Real-time streaming AI pipeline, voice latency optimization |
| Curriculum FSM | 14-15 | Adaptive learning engine, skill graph FSM |
| Self-hosted LLM | 16-18 | Multi-model routing, self-hosted inference, agent architecture |
| Analytics | 19-20 | AI product metrics, A/B testing |

## Позиционирование после выполнения

- AI Systems Engineer
- LLM Infrastructure Architect
- Real-time AI Platform Engineer
