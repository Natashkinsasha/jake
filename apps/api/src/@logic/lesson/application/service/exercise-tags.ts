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
  let pairMatch: RegExpExecArray | null = PAIR_RE.exec(inner);
  while (pairMatch !== null) {
    const word = pairMatch[1];
    const definition = pairMatch[2];
    if (word && definition) {
      pairs.push({ word, definition });
    }
    pairMatch = PAIR_RE.exec(inner);
  }

  if (pairs.length === 0) return { cleanText: text.trim(), exercise: null };

  const cleanText = text.replace(EXERCISE_TAG_RE, "").trim();
  return { cleanText, exercise: { type: "matching", pairs } };
}

/**
 * Streaming-safe exercise tag extractor. Buffers incomplete tags across chunks.
 * Call `push()` for each chunk, `flush()` at stream end.
 *
 * Tracks whether we are inside an `<exercise>` tag so that inner tags like
 * `<pair .../>` don't accidentally flush the buffer.
 */
export class ExerciseTagBuffer {
  private buffer = "";
  private insideExercise = false;

  push(chunk: string): { cleanText: string; exercise: ParsedExercise | null } {
    this.buffer += chunk;

    // If we're already inside an <exercise> tag, keep buffering until </exercise>
    if (this.insideExercise) {
      if (!this.buffer.includes("</exercise>")) {
        return { cleanText: "", exercise: null };
      }
      // We have the closing tag — extract
      this.insideExercise = false;
      const result = extractExerciseTag(this.buffer);
      this.buffer = "";
      return result;
    }

    // Check if an <exercise> tag is starting (possibly incomplete)
    const exerciseIdx = this.buffer.indexOf("<exercise");
    if (exerciseIdx !== -1) {
      const afterExercise = this.buffer.slice(exerciseIdx);

      // Full exercise tag present — extract it
      if (afterExercise.includes("</exercise>")) {
        const result = extractExerciseTag(this.buffer);
        this.buffer = "";
        return result;
      }

      // Opening tag started but not closed yet — buffer everything from <exercise onwards
      this.insideExercise = true;
      const safeText = this.buffer.slice(0, exerciseIdx);
      this.buffer = afterExercise;
      return { cleanText: safeText, exercise: null };
    }

    // Check for partial prefix like "<exerc" at the end of buffer
    const lastOpenBracket = this.buffer.lastIndexOf("<");
    if (lastOpenBracket !== -1) {
      const afterOpen = this.buffer.slice(lastOpenBracket);
      if ("<exercise".startsWith(afterOpen)) {
        const safeText = this.buffer.slice(0, lastOpenBracket);
        this.buffer = afterOpen;
        return { cleanText: safeText, exercise: null };
      }
    }

    // No exercise tag — pass through
    const text = this.buffer;
    this.buffer = "";
    return { cleanText: text, exercise: null };
  }

  flush(): { cleanText: string; exercise: ParsedExercise | null } {
    this.insideExercise = false;
    const result = extractExerciseTag(this.buffer);
    this.buffer = "";
    return result;
  }
}
