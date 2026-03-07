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
