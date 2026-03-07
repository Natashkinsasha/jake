# Tutor Customization Design

## Overview

Replace hardcoded single tutor (Jake) with customizable tutor profiles. User selects gender + nationality, which determines personality, style, slang, and topics. Voice is selected separately, filtered by gender. All tutors are named Jake.

## Parameters

| Parameter | Values | Storage |
|-----------|--------|---------|
| Gender | `male`, `female` | `user_preferences.tutor_gender` |
| Nationality | `australian`, `british`, `scottish`, `american` | `user_preferences.tutor_nationality` |
| Voice | ElevenLabs voice ID | `user_preferences.tutor_voice_id` |

## 8 Unique Profiles

| Profile | Character |
|---------|-----------|
| Australian Male | Laid-back surfer, relaxed humor, Byron Bay vibes |
| Australian Female | Energetic, outdoor-lover, straightforward |
| British Male | Dry humor, bit of a snob, tea obsessed |
| British Female | Warm, sarcastic, book lover |
| Scottish Male | Rough but kind, whisky and football |
| Scottish Female | Sharp wit, independent, storyteller |
| American Male | Friendly optimist, sporty |
| American Female | Creative, positive, tech-savvy |

Each has unique biography, slang, habits, conversation topics. All named Jake.

## Backend Constants

### TUTOR_PROFILES

Object keyed by `[nationality][gender]`:

```ts
{
  personality: string      // biography, habits, quirks
  style: string           // communication style
  slang: string[]         // characteristic phrases
  topics: string[]        // favorite conversation topics
  promptFragment: string  // full prompt fragment for LLM
}
```

### TUTOR_VOICES

Array of available ElevenLabs voices:

```ts
{ id: string, name: string, gender: 'male' | 'female' }
```

## Prompt Assembly

```
BASE_PROMPT (teaching instructions, no personality)
+ TUTOR_PROFILES[nationality][gender].promptFragment (personality, slang, humor, topics)
+ Student context (profile, facts, emotions, grammar topics)
```

## Removed

- Tables: `tutors`, `user_tutors`
- Code: `TutorContract`, `TutorRepository`, `TutorController`, tutor module (or refactor)
- Seed logic for tutor
- References to `tutor.systemPrompt` / `tutor.voiceId` in lesson flow

## API

- `GET /tutor/profiles` — list of profiles with descriptions
- `GET /tutor/voices?gender=` — voices filtered by gender
- `PATCH /user/preferences` — already exists, add new fields

## Frontend

- **Modal** on "Start lesson" click when `tutor_gender === null`: gender -> nationality -> voice
- **Settings** page — "Tutor" section with same 3 parameters, changeable between lessons

## Lesson Flow Changes

- `LessonContextService` reads `gender`, `nationality`, `voiceId` from `user_preferences` instead of `user_tutors -> tutors`
- `PromptBuilder` assembles from `BASE_PROMPT + TUTOR_PROFILES[nat][gen]` instead of `tutor.systemPrompt`
- `lesson_started` WebSocket event sends `voiceId` from preferences
