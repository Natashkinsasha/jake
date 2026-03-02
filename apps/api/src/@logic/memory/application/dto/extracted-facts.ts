export interface ExtractedFact {
  category: string;
  fact: string;
}

export interface ExtractedError {
  text: string;
  correction: string;
  topic: string;
}
