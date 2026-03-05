import { Injectable, Logger } from "@nestjs/common";
import { LlmProvider } from "../../../../@lib/provider/src";
import type { LlmMessage, LlmResponse } from "../../../../@lib/provider/src";
import { ExerciseParserService } from "./exercise-parser.service";
import { SentenceBuffer } from "./sentence-buffer";
import type { Exercise } from "@jake/shared";

export interface StreamChunk {
  chunkIndex: number;
  text: string;
}

export interface StreamResult {
  fullText: string;
  exercise: Exercise | null;
  tokens: LlmResponse;
}

export interface StreamCallbacks {
  onChunk(chunk: StreamChunk): void;
  onEnd(result: StreamResult): void;
  onError(error: Error): void;
  onDiscard?(safetyText: string): void;
}

const MAX_BUFFER_AGE_MS = 300;

@Injectable()
export class StreamingPipelineService {
  private readonly logger = new Logger(StreamingPipelineService.name);

  constructor(
    private llm: LlmProvider,
    private exerciseParser: ExerciseParserService,
  ) {}

  async stream(
    systemPrompt: string,
    history: LlmMessage[],
    callbacks: StreamCallbacks,
    options?: { signal?: AbortSignal },
  ): Promise<void> {
    const sentenceBuffer = new SentenceBuffer();
    let chunkIndex = 0;
    let bufferStartTime: number | null = null;

    const emitChunk = (text: string) => {
      if (!options?.signal?.aborted) {
        callbacks.onChunk({ chunkIndex: chunkIndex++, text });
      }
    };

    const flushIfStale = () => {
      if (
        bufferStartTime !== null
        && Date.now() - bufferStartTime >= MAX_BUFFER_AGE_MS
        && sentenceBuffer.hasContent()
      ) {
        bufferStartTime = null;
        const flushed = sentenceBuffer.flush();
        if (flushed) emitChunk(flushed);
      }
    };

    try {
      const llmResponse = await this.llm.generateStream(
        systemPrompt,
        history,
        {
          onText: (delta) => {
            const sentences = sentenceBuffer.push(delta);

            for (const sentence of sentences) {
              emitChunk(sentence);
            }

            // Track buffer age: flush if text sits without a sentence boundary for too long
            if (sentences.length > 0) {
              bufferStartTime = sentenceBuffer.hasContent() ? Date.now() : null;
            } else if (sentenceBuffer.hasContent() && bufferStartTime === null) {
              bufferStartTime = Date.now();
            }

            flushIfStale();
          },
          onDone: () => {
            bufferStartTime = null;
            const remaining = sentenceBuffer.flush();
            if (remaining) emitChunk(remaining);
          },
        },
        { signal: options?.signal, spanName: "lesson.stream" },
      );

      if (options?.signal?.aborted) return;

      const exercise = this.exerciseParser.extract(llmResponse.text);
      const cleanText = this.exerciseParser.removeExerciseTags(llmResponse.text);

      callbacks.onEnd({
        fullText: cleanText,
        exercise,
        tokens: llmResponse,
      });
    } catch (error) {
      if (options?.signal?.aborted) return;
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
