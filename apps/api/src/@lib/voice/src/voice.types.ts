export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
}

export interface SynthesisOptions {
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
}
