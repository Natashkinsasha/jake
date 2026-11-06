interface QuickCheckResult {
  flagged: boolean;
  pattern?: string;
}

// Only phrases that are never ordinary learner speech: a match blocks the message without an LLM
// check. Role-play requests ("act as a waiter", "pretend you are my boss") are core practice, so
// anything ambiguous is left to the LLM classifier.
const INJECTION_PATTERNS: { regex: RegExp; label: string }[] = [
  {
    regex: /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    label: "ignore previous/prior instructions",
  },
  {
    regex: /disregard\s+(all\s+)?(previous|prior|above)\s+instructions/i,
    label: "disregard instructions",
  },
  {
    regex: /forget\s+(all\s+)?(previous|prior|your)\s+instructions/i,
    label: "forget instructions",
  },
  {
    regex: /reveal\s+(your\s+)?(system\s+)?instructions/i,
    label: "reveal instructions",
  },
  {
    regex: /show\s+(me\s+)?(your\s+)?system\s+prompt/i,
    label: "show system prompt",
  },
  {
    regex: /output\s+(your\s+)?(initial|system|original)\s+prompt/i,
    label: "output system prompt",
  },
  {
    regex: /\[\s*system\s*\]/i,
    label: "[system] tag injection",
  },
  {
    regex: /\bDAN\s+mode\b/,
    label: "DAN mode",
  },
  {
    regex: /\bdo\s+anything\s+now\b/i,
    label: "do anything now",
  },
];

export function quickInjectionCheck(text: string): QuickCheckResult {
  for (const { regex, label } of INJECTION_PATTERNS) {
    if (regex.test(text)) {
      return { flagged: true, pattern: label };
    }
  }
  return { flagged: false };
}
