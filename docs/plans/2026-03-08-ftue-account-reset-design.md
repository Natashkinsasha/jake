# FTUE (First Time User Experience) + Account Reset

## Problem

New users start lessons without any level assessment. The tutor doesn't know the student's proficiency, usage patterns, or goals. There's also no way to reset an account to start fresh.

## Design

### 1. Onboarding Mode

When `onboardingCompleted === false`, the tutor enters ONBOARDING MODE:

**Behavior:**
- Speech is maximally simple and slow (short sentences, basic vocabulary)
- `speechSpeed` forced to `very_slow` regardless of user preferences
- Tutor focuses on getting to know the student, minimal exercises
- Can give simple tasks to assess level
- May use student's native language if they don't understand at all

**Questions to cover (naturally, not as a quiz):**
- How often do you use English?
- When was the last time you used it?
- In what context? (work, travel, media, etc.)

**Level assessment:**
- Tutor evaluates level based on HOW the student responds (grammar, vocabulary, fluency)
- Gradual assessment through natural conversation, not formal testing

### 2. Structured Output for Onboarding State

During onboarding, Claude returns metadata with each response:

```json
{ "onboarding": { "completed": false } }
```

When the tutor is confident about the level:

```json
{ "onboarding": { "completed": true, "level": "A2" } }
```

Levels: A1, A2, B1, B2, C1, C2

### 3. Runtime Flow Changes

**Lesson start** (`LessonMaintainer.startLesson`):
- Check `onboardingCompleted` on user record
- If `false`:
  - Add ONBOARDING MODE block to system prompt
  - Force `speechSpeed = "very_slow"` for the session
  - Store `onboarding: true` flag in Redis session

**Message handling** (during streaming):
- If session is in onboarding mode, parse structured output from Claude
- Extract `message` for client delivery and `onboarding` metadata for logic
- If `onboarding.completed === true`:
  - Update `currentLevel` and `onboardingCompleted = true` in DB
  - Remove `onboarding` flag from Redis session
  - Remove ONBOARDING MODE from system prompt in session
  - Switch `speechSpeed` to value from user_preferences
  - Send `onboarding_completed` event to client with level

**Cross-lesson persistence:**
- If user ends lesson before onboarding completes, next lesson starts in onboarding mode again
- Previous conversation history available via memory/facts, so tutor won't repeat questions

### 4. Account Reset

**API:** `DELETE /auth/me/reset` (JWT required)

Single transaction deletes all user data:
- `lesson_messages` (cascades from lessons)
- `lessons`
- `memory_facts`
- `memory_embeddings`
- `vocabulary`
- `grammar_progress`
- Reset `user_preferences` to defaults
- Reset `currentLevel = null`, `onboardingCompleted = false`

User stays logged in. JWT not invalidated.

**Frontend:** Button in `SettingsDrawer`
- Red "Reset account" button at the bottom of settings
- Confirmation modal: "All lessons, progress, and memory will be deleted. Continue?"
- After confirmation: call API, refresh profile data, close drawer
- User lands on dashboard as if new (no level, onboarding restarts)
