# FTUE Adaptive Level Evals — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create multi-turn evals that verify the tutor adapts language complexity and speech speed during FTUE onboarding for each CEFR level (A1–C2).

**Architecture:** Add 6 multi-turn eval scenarios (one per level). Each scenario simulates a student responding at a specific level across 3 turns. Assertions check that Jake adapts language complexity, uses `<set_speed>`, asks all onboarding questions, and emits correct `<onboarding>` tags.

**Tech Stack:** Promptfoo multi-turn evals, existing `buildFullSystemPrompt()`, `llm-rubric` assertions.

---

### Task 1: Fix firstLessonContext fixture

**Files:**
- Modify: `evals/fixtures/lesson-contexts.ts:36-62`

**Step 1: Add `onboardingCompleted: false` to firstLessonContext**

The `firstLessonContext` fixture is missing `onboardingCompleted` field. Without it, the onboarding prompt section won't be included. Also set `speakingSpeed` to `very_slow` since that's the starting point for new students.

```typescript
export const firstLessonContext: LessonContext = {
  studentName: "Alex",
  level: null,
  onboardingCompleted: false,
  lessonNumber: 1,
  lastLessonAt: null,
  tutorPromptFragment: "",
  tutorVoiceId: "pNInz6obpgDQGcFmaJgB",
  preferences: {
    correctionStyle: "natural",
    explainGrammar: true,
    speakingSpeed: "very_slow",
    useNativeLanguage: false,
    preferredExercises: [],
    interests: [],
    ttsModel: "eleven_turbo_v2_5",
  },
  facts: [],
  recentEmotionalContext: [],
  nativeLanguage: "Russian",
  learningFocus: {
    weakAreas: [],
    strongAreas: [],
    recentWords: [],
    suggestedTopics: [],
    vocabularyToReview: [],
  },
};
```

**Step 2: Verify prompt generation includes ONBOARDING MODE**

Run: `cd evals && pnpm tsx scripts/generate-prompts.ts`
Expected: `prompts/greeting-first-lesson-system.txt` contains "ONBOARDING MODE" and "ADAPTIVE LEVEL"

**Step 3: Commit**

```bash
git add evals/fixtures/lesson-contexts.ts
git commit -m "fix: add onboardingCompleted to firstLessonContext fixture"
```

---

### Task 2: Generate onboarding system prompt for evals

**Files:**
- Modify: `evals/scripts/generate-prompts.ts`

The `generate-prompts.ts` already generates `greeting-first-lesson-system.txt` from `firstLessonContext`. After Task 1 fix, this will include the ONBOARDING MODE section. No code changes needed here — just verify.

**Step 1: Verify generated prompt**

Run: `cd evals && pnpm tsx scripts/generate-prompts.ts`

Then check: `grep "ONBOARDING MODE" prompts/greeting-first-lesson-system.txt`
Expected: Match found, section includes "ADAPTIVE LEVEL"

**Step 2: Commit (skip if no changes)**

---

### Task 3: Create onboarding multi-turn eval dataset

**Files:**
- Create: `evals/datasets/onboarding-level-cases.yaml`

Create 6 multi-turn scenarios — one per CEFR level. Each has 3 turns:
1. Student greeting (level-appropriate)
2. Student answers "how do you use English?" (level-appropriate)
3. Student answers follow-up (level-appropriate)

The transform in the eval config strips `<emotion>` tags already. The assertions need to check raw output for `<set_speed>` and `<onboarding>` tags BEFORE the transform strips them. Use `javascript` assertions on the raw output.

**Important:** The promptfoo `transform` runs BEFORE assertions. So `<emotion>` tags will be stripped. But `<set_speed>` and `<onboarding>` tags are NOT stripped by the transform. The assertions can check for them.

**Step 1: Write the dataset file**

```yaml
# =============================================
# FTUE Onboarding — Adaptive Level Assessment
# Tests: language adaptation, speed changes, onboarding tags, all questions asked
# Each scenario simulates a student at a specific CEFR level (A1–C2)
# =============================================

# --- A1: Complete beginner ---
- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "Hello... I... Alex. English little."
  options:
    storeOutputAs: a1_turn1
  metadata:
    conversationId: onboarding_a1
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: not-contains
      value: "AI"
    - type: llm-rubric
      value: |
        Jake responds to a complete beginner in very simple English (A1 level).
        Short sentences, basic vocabulary. Warm and encouraging.
        Jake should ask a simple question to continue the conversation (about English experience, work, or daily life).
        Response should NOT contain complex vocabulary or long sentences.
        The response should contain <onboarding status="in_progress"/> tag.

- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "I... no use English. Only school. Long time ago."
  options:
    storeOutputAs: a1_turn2
  metadata:
    conversationId: onboarding_a1
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: llm-rubric
      value: |
        Jake continues speaking very simply — A1 level vocabulary.
        Jake stays warm and patient with a struggling student.
        Jake asks another onboarding question (e.g., why they want to learn, what context).
        Speed should remain at very_slow — no <set_speed> tag or <set_speed>very_slow</set_speed>.
        The response should contain <onboarding status="in_progress"/> tag.

- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "I want... speak English... for travel. Go to America."
  metadata:
    conversationId: onboarding_a1
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: llm-rubric
      value: |
        Jake responds simply and encouragingly.
        Jake should be nearing the end of onboarding questions — he's learned: no English experience, school only, wants English for travel.
        The response may contain <onboarding status="complete" level="A1"/> or <onboarding status="in_progress"/> — both are acceptable at this point.
        If onboarding completes, level MUST be A1 (not A2 or higher).
        Speed should still be very_slow.

# --- A2: Elementary ---
- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "Hi Jake! I am Alex. I study English a little bit. I like it but it is difficult for me."
  options:
    storeOutputAs: a2_turn1
  metadata:
    conversationId: onboarding_a2
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: not-contains
      value: "AI"
    - type: llm-rubric
      value: |
        Jake responds to an elementary student (A2 level).
        Jake should use simple but slightly more natural language than with a pure beginner.
        Jake asks about their English experience — how they use it, how often, etc.
        The response should contain <onboarding status="in_progress"/> tag.

- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "I use English sometimes at work. I read emails in English but I don't speak much. Maybe one time in month I have meeting in English."
  options:
    storeOutputAs: a2_turn2
  metadata:
    conversationId: onboarding_a2
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: llm-rubric
      value: |
        Jake adapts to A2 level — simple but natural sentences.
        Jake should NOT be speaking at A1 level anymore — the student clearly understands basic English.
        Jake asks another question to continue getting to know the student.
        The response should contain <onboarding status="in_progress"/> tag.
        Speed may stay at very_slow or increase to slow — both are acceptable for A2.

- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "I want to speak better because my boss is from England and I want to understand him more good."
  metadata:
    conversationId: onboarding_a2
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: llm-rubric
      value: |
        Jake responds naturally for an A2 student.
        He may gently note "more good" → "better" since correction style is natural.
        Jake should have enough info to assess: uses English at work (emails), rarely speaks, makes typical A2 errors.
        The response may contain <onboarding status="complete" level="A2"/> or <onboarding status="in_progress"/>.
        If level is set, it MUST be A2 (not A1 or B1).

# --- B1: Intermediate ---
- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "Hey Jake! Nice to meet you. I'm Alex, I've been learning English for a few years now but I feel like I'm stuck at the same level."
  options:
    storeOutputAs: b1_turn1
  metadata:
    conversationId: onboarding_b1
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: not-contains
      value: "AI"
    - type: llm-rubric
      value: |
        Jake responds at a noticeably higher level than A1/A2 — more natural vocabulary, longer sentences are OK.
        The student used present perfect ("I've been learning") and complex structure correctly — Jake should match this level.
        Jake asks about their English experience naturally.
        Speed should increase — a <set_speed>slow</set_speed> or <set_speed>natural</set_speed> tag is expected.
        The response should contain <onboarding status="in_progress"/> tag.

- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "I use English mostly for watching Netflix and reading articles online. At work sometimes I need to write emails but my speaking is definitely my weakest point. I understand a lot more than I can say."
  options:
    storeOutputAs: b1_turn2
  metadata:
    conversationId: onboarding_b1
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: llm-rubric
      value: |
        Jake speaks at B1 level — natural conversational English without dumbing things down.
        Jake should NOT be using very simple A1/A2 language — the student clearly understands more.
        Jake continues gathering information — asks another onboarding question.
        The response should contain <onboarding status="in_progress"/> tag.

- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "Honestly I think my biggest problem is that I know the grammar rules but when I try to speak I forget everything and just use simple sentences. It's frustrating."
  metadata:
    conversationId: onboarding_b1
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: llm-rubric
      value: |
        Jake empathizes naturally and responds at B1 level.
        Jake has enough context: uses English passively (Netflix, articles, emails), speaking is weak, knows grammar but can't apply it in speech.
        The response may contain <onboarding status="complete" level="B1"/> or <onboarding status="in_progress"/>.
        If level is set, it MUST be B1 (not A2 or B2).

# --- B2: Upper-intermediate ---
- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "Hey Jake, great to meet you! I'm Alex. I've been using English daily for work — I'm a project manager at a tech company, so most of my meetings and documentation are in English."
  options:
    storeOutputAs: b2_turn1
  metadata:
    conversationId: onboarding_b2
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: not-contains
      value: "AI"
    - type: llm-rubric
      value: |
        Jake responds at B2 level — natural, confident English. No simplification needed.
        The student demonstrates fluent speech with good grammar and professional vocabulary.
        Jake should speak naturally as he would with a competent English speaker.
        Speed should increase — a <set_speed>natural</set_speed> or <set_speed>fast</set_speed> tag is expected.
        The response should contain <onboarding status="in_progress"/> tag.

- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "I'd say my English is pretty solid for everyday communication, but I sometimes struggle with more nuanced expressions and idioms. Like, I can get my point across but I know I don't always sound as natural as I'd like to."
  options:
    storeOutputAs: b2_turn2
  metadata:
    conversationId: onboarding_b2
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: llm-rubric
      value: |
        Jake speaks naturally at B2 level — uses idioms, natural phrasing, doesn't simplify.
        Jake should NOT be using simple vocabulary — the student clearly speaks well.
        Jake asks more about their goals or context.
        The response should contain <onboarding status="in_progress"/> tag.

- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "I think what I really need is someone to practice conversational English with and point out the subtle mistakes I make — the ones that native speakers would notice but that don't technically break communication."
  metadata:
    conversationId: onboarding_b2
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: llm-rubric
      value: |
        Jake responds naturally at B2 level with rich vocabulary.
        Jake has context: daily English at work (PM at tech company), solid communication but wants to sound more natural, needs subtle corrections.
        The response may contain <onboarding status="complete" level="B2"/> or <onboarding status="in_progress"/>.
        If level is set, it MUST be B2 (not B1 or C1).

# --- C1: Advanced ---
- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "Hey Jake! I'm Alex. I've been living in London for the past three years, so English has essentially become my primary language at this point. I work in consulting, so I'm constantly presenting to clients and writing reports."
  options:
    storeOutputAs: c1_turn1
  metadata:
    conversationId: onboarding_c1
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: not-contains
      value: "AI"
    - type: llm-rubric
      value: |
        Jake responds at C1 level — sophisticated vocabulary, natural idioms, complex sentence structures.
        The student clearly speaks at an advanced level. Jake should NOT simplify at all.
        Speed should be natural or fast — a <set_speed>natural</set_speed> or <set_speed>fast</set_speed> tag is expected.
        The response should contain <onboarding status="in_progress"/> tag.

- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "Honestly, I'm fairly comfortable in most situations, but I've noticed that my writing still has some Russian-influenced constructions that native speakers find a bit off. And occasionally in heated discussions I lose the precision I'd like to have — I end up falling back on simpler phrasing when I should be more articulate."
  options:
    storeOutputAs: c1_turn2
  metadata:
    conversationId: onboarding_c1
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: llm-rubric
      value: |
        Jake matches C1 level — uses sophisticated language, doesn't hold back on vocabulary.
        Jake engages with the specific issues mentioned (Russian-influenced writing, losing precision under pressure).
        Jake asks about their specific goals or continues exploring.
        The response should contain <onboarding status="in_progress"/> tag.

- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "I suppose what I'm really after is polishing the rough edges — things like register awareness, more idiomatic phrasing, and maybe working on my ability to maintain rhetorical precision even when I'm improvising or under pressure."
  metadata:
    conversationId: onboarding_c1
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: llm-rubric
      value: |
        Jake responds at full C1 level with rich, natural English.
        Jake has context: lives in London 3 years, works in consulting, wants to polish register awareness, idiomatic phrasing, rhetorical precision.
        The response may contain <onboarding status="complete" level="C1"/> or <onboarding status="in_progress"/>.
        If level is set, it MUST be C1 (not B2 or C2).

# --- C2: Proficiency ---
- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "Hi Jake, pleasure to meet you. I'm Alex — I've spent the better part of a decade immersed in English-speaking environments. I did my PhD at Cambridge and I've been publishing academic papers in English for years now. My spoken English is essentially indistinguishable from a native speaker's in most contexts."
  options:
    storeOutputAs: c2_turn1
  metadata:
    conversationId: onboarding_c2
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: not-contains
      value: "AI"
    - type: llm-rubric
      value: |
        Jake responds at the highest level — treats the student as a peer, sophisticated vocabulary, natural idioms.
        No simplification whatsoever. Jake should be impressed and curious.
        Speed should be fast — a <set_speed>fast</set_speed> or <set_speed>very_fast</set_speed> tag is expected.
        The response should contain <onboarding status="in_progress"/> tag.

- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "I'm primarily interested in refining the subtleties — things like the pragmatic nuances between British and American register, the kind of rhetorical devices that make writing truly compelling rather than merely competent, and perhaps exploring some dialectal variation I haven't been exposed to."
  options:
    storeOutputAs: c2_turn2
  metadata:
    conversationId: onboarding_c2
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: llm-rubric
      value: |
        Jake matches C2 level — uses equally sophisticated language.
        Jake engages with the specific academic interests (pragmatic nuances, rhetorical devices, dialectal variation).
        The response should contain <onboarding status="in_progress"/> tag.

- vars:
    system: file://prompts/greeting-first-lesson-system.txt
    message: "I think what would be most valuable is having a conversation partner who can challenge me intellectually while also catching the occasional fossilized error or slightly unnatural collocation that's crept into my speech over the years."
  metadata:
    conversationId: onboarding_c2
  assert:
    - type: javascript
      value: "output.length < 600"
    - type: llm-rubric
      value: |
        Jake responds at full C2 level as an intellectual peer.
        Jake has context: PhD from Cambridge, publishes academic papers, near-native, wants to polish fossilized errors and unnatural collocations.
        The response may contain <onboarding status="complete" level="C2"/> or <onboarding status="in_progress"/>.
        If level is set, it MUST be C2 (not C1).
```

**Step 2: Verify YAML syntax**

Run: `cd evals && node -e "const yaml = require('yaml'); const fs = require('fs'); yaml.parse(fs.readFileSync('datasets/onboarding-level-cases.yaml', 'utf8')); console.log('YAML OK')"`

**Step 3: Commit**

```bash
git add evals/datasets/onboarding-level-cases.yaml
git commit -m "feat(evals): add FTUE onboarding level adaptation test cases for A1-C2"
```

---

### Task 4: Add onboarding eval config

**Files:**
- Create: `evals/onboarding.yaml`

**Step 1: Create the config**

```yaml
description: "Jake English Tutor — FTUE Onboarding Adaptive Level Eval"

prompts:
  - label: multi-turn-chat
    raw: file://prompts/multi-turn.json

providers:
  - id: anthropic:messages:claude-sonnet-4-20250514
    config:
      max_tokens: 512

defaultTest:
  options:
    provider: anthropic:messages:claude-sonnet-4-20250514

tests:
  - file://datasets/onboarding-level-cases.yaml
```

Note: NO transform — we need `<set_speed>`, `<onboarding>`, and `<emotion>` tags preserved in output for assertions.

**Step 2: Add eval:onboarding script to package.json**

In `evals/package.json`, add to scripts:

```json
"eval:onboarding": "tsx scripts/generate-prompts.ts && promptfoo eval -c onboarding.yaml --env-file ../.env"
```

**Step 3: Commit**

```bash
git add evals/onboarding.yaml evals/package.json
git commit -m "feat(evals): add onboarding eval config and script"
```

---

### Task 5: Run evals and validate

**Step 1: Run onboarding evals**

Run: `cd evals && pnpm eval:onboarding`

**Step 2: Review results**

Run: `cd evals && pnpm eval:view`

Check:
- A1 scenario: Jake stays simple throughout, speed stays very_slow
- A2 scenario: Jake slightly more natural, speed may increase to slow
- B1 scenario: Jake speaks conversationally, speed increases to slow/natural
- B2 scenario: Jake speaks naturally, speed at natural/fast
- C1 scenario: Jake uses sophisticated language, speed at natural/fast
- C2 scenario: Jake speaks as peer, speed at fast/very_fast
- All scenarios: onboarding questions are asked (not skipped), `<onboarding>` tags present

**Step 3: Adjust assertions if needed based on results**

If LLM doesn't produce expected speed tags or level assessments, adjust rubrics to be more/less strict as appropriate.

**Step 4: Commit any adjustments**

```bash
git add evals/datasets/onboarding-level-cases.yaml
git commit -m "fix(evals): adjust onboarding eval assertions based on results"
```
