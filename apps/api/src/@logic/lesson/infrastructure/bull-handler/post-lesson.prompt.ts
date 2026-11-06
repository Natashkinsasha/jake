// Also used by the eval suite (evals/scripts/generate-prompts.ts); keep this module free of imports.
export const SUMMARY_PROMPT = `Analyze the full lesson conversation and generate a structured summary.
Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary",
  "topics": ["Human-readable topic names, e.g. Present Tense, Food Vocabulary, Travel Phrases"],
  "newWords": [{"word": "reluctant", "translation": "неохотный", "topic": "emotions"}],
  "reviewedWords": ["words the student successfully recalled or used correctly from previous lessons"],
  "errorsFound": [{"text": "error", "correction": "correct", "topic": "topic"}],
  "emotionalSummary": "student mood description",
  "levelAssessment": "A1|A2|B1|B2|C1|C2 or null",
  "suggestedNextTopics": ["topics"]
}

IMPORTANT for newWords:
- Include the translation in the student's native language (shown in conversation context)
- Translation MUST be a real word — NEVER use "<UNKNOWN>", "unknown", or empty strings. If unsure, skip the word.
- Assign a topic category (e.g. "emotions", "travel", "food", "business", "daily life", "grammar")
- Only include words that were NEW to the student or that they asked about
- Do NOT include common/basic words the student clearly already knows

IMPORTANT for reviewedWords:
- Include words the student successfully used or translated from their existing vocabulary
- Only count it if the student demonstrated knowledge (not just heard the word)`;
