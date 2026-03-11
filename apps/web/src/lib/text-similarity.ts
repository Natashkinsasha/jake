/**
 * Simple word-overlap similarity (Jaccard-like).
 * Returns 0.0 (no overlap) to 1.0 (identical).
 */
export function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));

  if (wordsA.size === 0 && wordsB.size === 0) {
    return 1.0;
  }
  if (wordsA.size === 0 || wordsB.size === 0) {
    return 0.0;
  }

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersection++;
    }
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

const SIMILARITY_THRESHOLD = 0.5;

export function shouldAbortForRevision(lastSentText: string, newText: string): boolean {
  if (!lastSentText) {
    return false;
  }
  return textSimilarity(lastSentText, newText) < SIMILARITY_THRESHOLD;
}
