export abstract class EmbeddingProvider {
  abstract embed(text: string): Promise<number[]>;
}
