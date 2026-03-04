import { Injectable, Logger } from "@nestjs/common";
import { LlmProvider, TtsProvider } from "../../../../@lib/provider/src";
import type { LlmMessage, LlmResponse } from "../../../../@lib/provider/src";
import { ExerciseParserService } from "./exercise-parser.service";
import { SentenceBuffer } from "./sentence-buffer";
import type { Exercise } from "@jake/shared";

export interface StreamChunk {
  chunkIndex: number;
  text: string;
  audio: string;
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
}

@Injectable()
export class StreamingPipelineService {
  private readonly logger = new Logger(StreamingPipelineService.name);

  constructor(
    private llm: LlmProvider,
    private tts: TtsProvider,
    private exerciseParser: ExerciseParserService,
  ) {}

  async stream(
    systemPrompt: string,
    history: LlmMessage[],
    voiceId: string,
    callbacks: StreamCallbacks,
    options?: { speechSpeed?: number; signal?: AbortSignal },
  ): Promise<void> {
    const buffer = new SentenceBuffer();
    const ttsPromises: Promise<void>[] = [];
    let chunkIndex = 0;

    const synthesizeAndEmit = (text: string, idx: number) => {
      const promise = this.tts
        .synthesize(text, voiceId, options?.speechSpeed)
        .then((audio) => {
          if (!options?.signal?.aborted) {
            callbacks.onChunk({ chunkIndex: idx, text, audio });
          }
        })
        .catch((error: unknown) => {
          this.logger.warn(`TTS failed for chunk ${idx}, sending text-only: ${error instanceof Error ? error.message : String(error)}`);
          if (!options?.signal?.aborted) {
            callbacks.onChunk({ chunkIndex: idx, text, audio: "" });
          }
        });
      ttsPromises.push(promise);
    };

    try {
      const llmResponse = await this.llm.generateStream(
        systemPrompt,
        history,
        {
          onText: (delta) => {
            const sentences = buffer.push(delta);
            for (const sentence of sentences) {
              synthesizeAndEmit(sentence, chunkIndex++);
            }
          },
          onDone: () => {
            const remaining = buffer.flush();
            if (remaining) {
              synthesizeAndEmit(remaining, chunkIndex++);
            }
          },
        },
        { signal: options?.signal },
      );

      if (options?.signal?.aborted) return;

      await Promise.all(ttsPromises);

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
