export interface VocabHighlight {
  word: string;
  translation: string;
  topic: string;
}

const VOCAB_TAG_RE = /<vocab\s+word="([^"]+)"\s+translation="([^"]+)"\s+topic="([^"]+)"\s*\/>/g;
const VOCAB_REVIEWED_RE = /<vocab_reviewed\s+word="([^"]+)"\s*\/>/g;

export function extractVocabTags(text: string): {
  cleanText: string;
  highlights: VocabHighlight[];
  reviewedWords: string[];
} {
  const highlights: VocabHighlight[] = [];
  const reviewedWords: string[] = [];

  let cleanText = text.replaceAll(VOCAB_TAG_RE, (_, word: string, translation: string, topic: string) => {
    highlights.push({ word, translation, topic });
    return "";
  });

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
      if (/^<vocab/.test(afterOpen) && !/>/.test(afterOpen)) {
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
