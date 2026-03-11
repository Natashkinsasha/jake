const BACKCHANNEL_PHRASES = new Set([
  "yeah",
  "yes",
  "yep",
  "yup",
  "no",
  "nope",
  "nah",
  "ok",
  "okay",
  "k",
  "uh-huh",
  "uh huh",
  "uhuh",
  "mm",
  "mmm",
  "mhm",
  "mm-hmm",
  "hmm",
  "ah",
  "oh",
  "uh",
  "right",
  "sure",
  "fine",
  "wow",
  "cool",
  "nice",
  "thanks",
  "thank you",
  "got it",
  "i see",
]);

// Short phrases that should always interrupt (user commands)
const ACTION_PHRASES = new Set([
  "stop",
  "wait",
  "pause",
  "help",
  "help me",
  "stop it",
  "go back",
  "new topic",
  "start over",
  "slow down",
  "speed up",
]);

export function isBackchannel(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replaceAll(/[.,!?]/g, "");
  if (ACTION_PHRASES.has(normalized)) return false;
  if (BACKCHANNEL_PHRASES.has(normalized)) return true;
  return normalized.split(/\s+/).filter(Boolean).length < 2;
}
