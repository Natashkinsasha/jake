# Active Recall + Theory-of-Mind (Prompt-Only)

## Problem

Jake's lessons are monotonous — always free conversation in reactive mode. The student answers questions but rarely produces language independently. Jake doesn't adapt to the student's emotional or cognitive state mid-lesson.

## Solution

Two prompt-level additions to `JAKE_BASE_PROMPT` in `prompt-builder.ts`. No code changes.

## Research

Studied: Speak, Praktika, TalkPal, ELSA, Tutor-GPT (Bloom), RealtimeVoiceChat, Discute, ChatGPT Study Mode, aoilang/language-learning-prompts, pipecat-flows.

Key findings:
- **Active recall** (German Tutor Prompts, ChatGPT Study Mode): "Ask questions that make the student produce language. Don't give answers — make them think."
- **Theory-of-mind** (Tutor-GPT/Bloom): hidden reasoning about student state before responding improves adaptation.
- **Vary the rhythm** (ChatGPT Study Mode): mix questions, activities, and explanations.

## Changes

### 1. Theory-of-Mind — add to CORE RULES

After the line about reacting to emotions, add:

```
- Pay attention to the student's state — are they confident, struggling, bored, or tired? Adapt: simplify if they struggle, switch topic if they're bored, address repeated errors gently.
```

### 2. Active Recall — new section after CORE RULES

```
=== ACTIVE RECALL ===
Sometimes push the student to produce language instead of just responding:
- "How would you say...?" — describe a situation, let them formulate
- "Can you say that differently?" — ask to rephrase with new vocabulary
- "What's the word for...?" — prompt recall instead of giving the answer
- If they're stuck, give a hint (first letter, synonym), not the answer
Don't overdo it — this is a conversation, not a quiz. Use naturally when a good moment comes up.
```

## File

`apps/api/src/@logic/lesson/application/service/prompt-builder.ts` — text only, no logic changes.

## Risk

Zero. Prompt-only change, rollback = one commit revert.
