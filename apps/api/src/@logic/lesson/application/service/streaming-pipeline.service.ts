import type { LlmMessage, LlmProvider, LlmResponse } from "@lib/provider/src";
import { Injectable } from "@nestjs/common";
import { parseEmotion } from "./emotion";
import { SentenceBuffer } from "./sentence-buffer";

export interface StreamChunk {
  chunkIndex: number;
  text: string;
}

export interface StreamResult {
  fullText: string;
  tokens: LlmResponse;
}

export interface StreamCallbacks {
  onChunk(chunk: StreamChunk): void;
  onEnd(result: StreamResult): void;
  onError(error: Error): void;
  onDiscard?(safetyText: string): void;
  onSpeedChange?(speed: string): void;
  onEmotion?(emotion: string): void;
  onOnboardingComplete?: (data: { level: string }) => void;
  onVocabHighlight?(highlight: { word: string; translation: string; topic: string }): void;
  onVocabReviewed?(word: string): void;
  onExercise?: (exercise: {
    exerciseId: string;
    type: string;
    pairs: Array<{ word: string; definition: string }>;
  }) => void;
}

const MAX_BUFFER_AGE_MS = 500;

@Injectable()
export class StreamingPipelineService {
  constructor(private llm: LlmProvider) {}

  async stream(
    systemPrompt: string,
    history: LlmMessage[],
    callbacks: StreamCallbacks,
    options?: { signal?: AbortSignal },
  ): Promise<void> {
    const sentenceBuffer = new SentenceBuffer();
    let chunkIndex = 0;
    let bufferStartTime: number | null = null;
    let rawAccumulator = "";
    let emotionExtracted = false;

    const emitChunk = (text: string) => {
      if (!options?.signal?.aborted) {
        callbacks.onChunk({ chunkIndex: chunkIndex++, text });
      }
    };

    const flushIfStale = () => {
      if (
        bufferStartTime !== null &&
        Date.now() - bufferStartTime >= MAX_BUFFER_AGE_MS &&
        sentenceBuffer.hasContent()
      ) {
        bufferStartTime = null;
        const flushed = sentenceBuffer.flush();
        if (flushed) {
          emitChunk(flushed);
        }
      }
    };

    try {
      const llmResponse = await this.llm.generateStream(
        systemPrompt,
        history,
        {
          onText: (delta) => {
            // Accumulate raw text to detect emotion tag before passing to sentence buffer
            let currentDelta = delta;
            if (!emotionExtracted) {
              rawAccumulator += currentDelta;
              const closeIdx = rawAccumulator.indexOf("</emotion>");
              if (closeIdx !== -1) {
                // Full tag received — extract and strip
                const { emotion, text } = parseEmotion(rawAccumulator);
                emotionExtracted = true;
                callbacks.onEmotion?.(emotion);
                currentDelta = text;
                rawAccumulator = "";
              } else if (rawAccumulator.length > 100 || !rawAccumulator.trimStart().startsWith("<")) {
                // No tag coming — flush accumulator as normal text
                emotionExtracted = true;
                callbacks.onEmotion?.("neutral");
                currentDelta = rawAccumulator;
                rawAccumulator = "";
              } else {
                // Still accumulating, wait for more
                return;
              }
            }

            const sentences = sentenceBuffer.push(currentDelta);

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
            if (remaining) {
              emitChunk(remaining);
            }
          },
        },
        { signal: options?.signal, spanName: "lesson.stream" },
      );

      if (options?.signal?.aborted) {
        return;
      }

      callbacks.onEnd({
        fullText: llmResponse.text,
        tokens: llmResponse,
      });
    } catch (error) {
      if (options?.signal?.aborted) {
        return;
      }
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
