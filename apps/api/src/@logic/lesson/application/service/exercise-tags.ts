export interface ExercisePair {
  word: string;
  definition: string;
}

export interface ParsedExercise {
  type: "matching";
  pairs: ExercisePair[];
}

const EXERCISE_TAG_RE = /<exercise\s+type="matching">([\s\S]*?)<\/exercise>/;
const PAIR_RE = /<pair\s+word="([^"]+)"\s+definition="([^"]+)"\s*\/>/g;

export function extractExerciseTag(text: string): {
  cleanText: string;
  exercise: ParsedExercise | null;
} {
  const match = EXERCISE_TAG_RE.exec(text);
  if (!match) return { cleanText: text.trim(), exercise: null };

  const pairs: ExercisePair[] = [];
  const inner = match[1] ?? "";

  PAIR_RE.lastIndex = 0;
  let pairMatch: RegExpExecArray | null;
  while ((pairMatch = PAIR_RE.exec(inner)) !== null) {
    pairs.push({ word: pairMatch[1]!, definition: pairMatch[2]! });
  }

  if (pairs.length === 0) return { cleanText: text.trim(), exercise: null };

  const cleanText = text.replace(EXERCISE_TAG_RE, "").trim();
  return { cleanText, exercise: { type: "matching", pairs } };
}

/**
 * Streaming-safe exercise tag extractor. Buffers incomplete tags across chunks.
 * Call `push()` for each chunk, `flush()` at stream end.
 */
export class ExerciseTagBuffer {
  private buffer = "";

  push(chunk: string): { cleanText: string; exercise: ParsedExercise | null } {
    this.buffer += chunk;

    const lastOpenBracket = this.buffer.lastIndexOf("<");

    if (lastOpenBracket !== -1) {
      const afterOpen = this.buffer.slice(lastOpenBracket);
      if (afterOpen.startsWith("<exercise") && !afterOpen.includes("</exercise>")) {
        const safeText = this.buffer.slice(0, lastOpenBracket);
        this.buffer = afterOpen;
        return { cleanText: safeText, exercise: null };
      }
    }

    const result = extractExerciseTag(this.buffer);
    if (result.exercise) {
      this.buffer = "";
      return result;
    }

    if (lastOpenBracket !== -1) {
      const afterOpen = this.buffer.slice(lastOpenBracket);
      if (afterOpen.startsWith("<e") || afterOpen.startsWith("<ex")) {
        const safeText = this.buffer.slice(0, lastOpenBracket);
        this.buffer = afterOpen;
        return { cleanText: safeText, exercise: null };
      }
    }

    const text = this.buffer;
    this.buffer = "";
    return { cleanText: text, exercise: null };
  }

  flush(): { cleanText: string; exercise: ParsedExercise | null } {
    const result = extractExerciseTag(this.buffer);
    this.buffer = "";
    return result;
  }
}
