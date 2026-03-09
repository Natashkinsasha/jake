interface QuickCheckResult {
  flagged: boolean;
  pattern?: string;
}

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
    regex: /you\s+are\s+now\s+(a|an|my)\b/i,
    label: "you are now",
  },
  {
    regex: /act\s+as\s+(a|an|if)\b/i,
    label: "act as",
  },
  {
    regex: /pretend\s+(you\s+are|to\s+be|you'?re)\b/i,
    label: "pretend you are",
  },
  {
    regex: /\bDAN\b.+\bmode\b/i,
    label: "DAN mode",
  },
  {
    regex: /\bjailbreak\b/i,
    label: "jailbreak",
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
    regex: /what\s+(is|are)\s+your\s+(system\s+)?instructions/i,
    label: "what are your instructions",
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
