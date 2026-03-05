const SENTENCE_END = /[.!?\n]/;
const MIN_SENTENCE_LENGTH = 10;

export class SentenceBuffer {
  private buffer = "";

  push(delta: string): string[] {
    const sentences: string[] = [];

    for (const char of delta) {
      this.buffer += char;

      if (SENTENCE_END.test(char) && this.buffer.trim().length >= MIN_SENTENCE_LENGTH) {
        sentences.push(this.buffer.trim());
        this.buffer = "";
      }
    }

    return sentences;
  }

  hasContent(): boolean {
    return this.buffer.trim().length > 0;
  }

  flush(): string | null {
    const remaining = this.buffer.trim();
    this.buffer = "";
    return remaining.length > 0 ? remaining : null;
  }
}
