# Vocabulary System Design

## Overview

Interactive vocabulary system for the Jake English Tutor app. Words are highlighted in real-time during lessons, saved after lesson ends, and tracked with a 5-review spaced repetition model.

## Decisions

- **Topic word suggestions**: LLM generates on the fly (not pre-built lists)
- **When words are added**: Real-time UI cards + post-lesson DB save
- **Review counting**: Both student usage in speech AND tutor quiz count as review
- **Translation language**: Based on `user_preferences.nativeLanguage`
- **Topic source**: Claude categorizes each word via tag attribute
- **Dashboard**: Compact widget, full vocabulary on separate `/vocabulary` page

## Data Model

### Table: `vocabulary` (modify existing)

**Add fields:**
- `translation` (varchar) — translation to nativeLanguage
- `topic` (varchar) — category (emotions, travel, business...)
- `review_count` (int, default 0) — number of successful reviews
- `status` (varchar: `new` | `learning` | `learned`)
- `last_reviewed_at` (timestamp)

**Remove fields:** `strength`, `next_review`

**New index:** `vocabulary_status_idx` on (user_id, status)

Word is `learned` when `review_count >= 5`.

## Claude Prompt Tags

```xml
<!-- New/explained word -->
<vocab word="reluctant" translation="неохотный" topic="emotions"/>

<!-- Student successfully recalled word -->
<vocab_reviewed word="reluctant"/>
```

System prompt additions:
- Before new topic: suggest 3-5 key words via `<vocab>` tags
- When student asks for translation: use `<vocab>` tag
- Periodically quiz words from `=== VOCABULARY TO REVIEW ===`
- On correct recall/usage: emit `<vocab_reviewed>`
- Translate to `{nativeLanguage}`

## WebSocket Events

**New Server → Client:**
- `vocab_highlight` — `{ word, translation, topic }` — show word card
- `vocab_reviewed` — `{ word }` — word reviewed successfully

## Lesson Flow

1. StreamingPipeline parses `<vocab>` tags → emits `vocab_highlight`
2. StreamingPipeline parses `<vocab_reviewed>` tags → emits `vocab_reviewed`
3. Tags are stripped from text before TTS
4. Post-lesson job saves words to DB

## Post-Lesson Job

Extended summarization schema:
```json
{
  "newWords": [{ "word": "reluctant", "translation": "неохотный", "topic": "emotions" }],
  "reviewedWords": ["reluctant"]
}
```

Logic:
- `newWords` → upsert with `status: new`, `review_count: 0`
- `reviewedWords` → `review_count++`, `last_reviewed_at = now()`
- If `review_count >= 5` → `status: learned`

## API Endpoints

- `GET /api/vocabulary` — query: `status?`, `topic?`, `lessonId?`, pagination
- `GET /api/vocabulary/stats` — `{ total, new, learning, learned, newLastLesson }`
- `GET /api/vocabulary/topics` — unique topics list
- `DELETE /api/vocabulary/:id`

## Dashboard Widget

Compact card:
- Three numbers: total / learned / new last lesson
- Mini progress bar (learned / total)
- Button → `/vocabulary`

## Vocabulary Page (`/vocabulary`)

- Filters: by status (all/new/learning/learned), by topic (dropdown), by lesson (dropdown)
- List: word | translation | topic badge | progress dots (●●●○○) | date added
- Delete word button
- Stats header: total / new / learning / learned
