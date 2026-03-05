const SENTENCE_END = /[.!?\n]/;
const MIN_SENTENCE_LENGTH = 10;

export class SentenceBuffer {
  private buffer = "";
  private insideExercise = false;
  private exerciseContent = "";

  push(delta: string): string[] {
    const sentences: string[] = [];

    for (const char of delta) {
      if (this.insideExercise) {
        this.exerciseContent += char;
        if (this.exerciseContent.endsWith("</exercise>")) {
          this.insideExercise = false;
        }
        continue;
      }

      this.buffer += char;

      if (this.buffer.endsWith("<exercise>")) {
        // Move the tag from buffer to exercise content
        this.buffer = this.buffer.slice(0, -"<exercise>".length);
        this.insideExercise = true;
        this.exerciseContent += "<exercise>";
        continue;
      }

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

  getExerciseContent(): string | null {
    return this.exerciseContent.length > 0 ? this.exerciseContent : null;
  }
}
