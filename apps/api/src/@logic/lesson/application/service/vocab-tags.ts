export interface VocabHighlight {
  word: string;
  translation: string;
  topic: string;
}

// Flexible regex: matches <vocab> with word/translation/topic attributes in ANY order
// eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity, regexp/no-super-linear-backtracking, regexp/no-contradiction-with-assertion -- lookahead for any-order attributes; input is controlled LLM output
const VOCAB_TAG_RE = /<vocab\s+(?=[^/]*?\bword="([^"]+)")(?=[^/]*?\btranslation="([^"]+)")(?=[^/]*?\btopic="([^"]+)")[^/]*\/>/g;
const VOCAB_REVIEWED_RE = /<vocab_reviewed\s+word="([^"]+)"\s*\/>/g;

// Fallback: strict order regex in case the lookahead one misses edge cases
const VOCAB_TAG_STRICT_RE = /<vocab\s+word="([^"]+)"\s+translation="([^"]+)"\s+topic="([^"]+)"\s*\/>/g;

export function extractVocabTags(text: string): {
  cleanText: string;
  highlights: VocabHighlight[];
  reviewedWords: string[];
} {
  const highlights: VocabHighlight[] = [];
  const reviewedWords: string[] = [];

  // Try flexible regex first, fallback to strict if no matches
  let cleanText = text.replaceAll(VOCAB_TAG_RE, (_, word: string, translation: string, topic: string) => {
    highlights.push({ word, translation, topic });
    return "";
  });

  if (highlights.length === 0) {
    cleanText = text.replaceAll(VOCAB_TAG_STRICT_RE, (_, word: string, translation: string, topic: string) => {
      highlights.push({ word, translation, topic });
      return "";
    });
  }

  cleanText = cleanText.replaceAll(VOCAB_REVIEWED_RE, (_, word: string) => {
    reviewedWords.push(word);
    return "";
  });

  return { cleanText: cleanText.trim(), highlights, reviewedWords };
}

/**
 * Streaming-safe vocab tag extractor. Buffers incomplete tags across chunks.
 * Call `push()` for each chunk, `flush()` at stream end.
 */
export class VocabTagBuffer {
  private buffer = "";

  push(chunk: string): { cleanText: string; highlights: VocabHighlight[]; reviewedWords: string[] } {
    this.buffer += chunk;

    // Check if there's an incomplete tag at the end (starts with < but no closing />)
    const lastOpenBracket = this.buffer.lastIndexOf("<");
    let safeText = this.buffer;
    let remainder = "";

    if (lastOpenBracket !== -1) {
      const afterOpen = this.buffer.slice(lastOpenBracket);
      // If it looks like a vocab tag starting but not closed yet
      if (afterOpen.startsWith("<vocab") && !afterOpen.includes(">")) {
        safeText = this.buffer.slice(0, lastOpenBracket);
        remainder = afterOpen;
      }
    }

    this.buffer = remainder;
    return extractVocabTags(safeText);
  }

  flush(): { cleanText: string; highlights: VocabHighlight[]; reviewedWords: string[] } {
    const result = extractVocabTags(this.buffer);
    this.buffer = "";
    return result;
  }
}
