# Tutor Emotions Design

## Goal
Add emotional expressiveness to the tutor via:
1. Claude selects an emotion tag per response
2. Emotion maps to ElevenLabs voice parameters (stability, similarity_boost, style)
3. Emotion influences text tone through prompt instructions

## Approach
**Inline tag (Approach A):** Claude adds `<emotion>name</emotion>` at the start of each response. Backend parses the tag, maps it to ElevenLabs parameters, strips the tag from spoken text.

## Emotion Set (10 emotions)

| Emotion | When | stability | similarity_boost | style |
|---------|------|-----------|-----------------|-------|
| `neutral` | normal conversation | 0.5 | 0.75 | 0.0 |
| `happy` | student shares good news, pleasant topic | 0.35 | 0.75 | 0.6 |
| `encouraging` | student tries hard, makes progress | 0.4 | 0.75 | 0.5 |
| `empathetic` | student is tired, frustrated | 0.55 | 0.8 | 0.3 |
| `excited` | shared interest, excellent answer | 0.3 | 0.7 | 0.8 |
| `curious` | asking questions, wants to learn more | 0.45 | 0.75 | 0.4 |
| `playful` | joking, teasing | 0.35 | 0.7 | 0.7 |
| `proud` | student nails something difficult | 0.35 | 0.75 | 0.65 |
| `thoughtful` | explaining grammar, giving advice | 0.55 | 0.8 | 0.2 |
| `surprised` | unexpected answer, interesting fact | 0.3 | 0.7 | 0.7 |

Default (missing tag): `neutral`.

## Components Changed

### 1. Prompt (`prompt-builder.ts`)
- Add emotion instructions to `JAKE_BASE_PROMPT`
- List available emotions with usage guidelines
- Instruct Claude to place `<emotion>name</emotion>` at the start of every response

### 2. Emotion parser (new: `emotion-parser.ts`)
- Parse `<emotion>...</emotion>` from Claude's response text
- Return `{ emotion: string, text: string }` (stripped text)
- Fallback to `neutral` if tag missing/invalid

### 3. Emotion-to-voice mapping (new: `emotion-voice-map.ts`)
- Map emotion name to ElevenLabs parameters `{ stability, similarity_boost, style }`
- Export `getVoiceParamsForEmotion(emotion: string)`

### 4. Streaming pipeline (`streaming-pipeline.service.ts`)
- After receiving first chunk, extract emotion tag
- Pass emotion params to TTS synthesis calls

### 5. Voice service (`voice` module)
- Accept optional emotion parameters in `synthesize()` method
- Apply stability/similarity_boost/style overrides to ElevenLabs API call

### 6. WebSocket events
- Include detected emotion in `tutor_chunk` and `tutor_stream_end` events (for potential future frontend use)
