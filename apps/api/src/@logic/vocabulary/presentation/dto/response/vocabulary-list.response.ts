export interface VocabularyListResponse {
  words: Array<{
    id: string;
    word: string;
    strength: number;
    nextReview: string | null;
  }>;
}
