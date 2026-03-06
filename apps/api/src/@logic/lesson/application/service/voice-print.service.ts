import { writeFileSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { type PreTrainedModel, type FeatureExtractor, AutoModel, AutoFeatureExtractor } from "@huggingface/transformers";
import { VoicePrintRepository } from "../../infrastructure/repository/voice-print.repository";

const MODEL_ID = "onnx-community/wespeaker-voxceleb-resnet34-LM";
const ENROLLMENT_SAMPLES = 3;
const SIMILARITY_THRESHOLD = 0.75;

export interface VoiceComparisonResult {
  status: "enrolling" | "match" | "mismatch";
  similarity?: number;
  samplesCollected?: number;
}

@Injectable()
export class VoicePrintService {
  private readonly logger = new Logger(VoicePrintService.name);
  private model: PreTrainedModel | null = null;
  private featureExtractor: FeatureExtractor | null = null;
  private loading: Promise<void> | null = null;
  private dimLogged = false;

  constructor(private voicePrintRepository: VoicePrintRepository) {}

  private async ensureLoaded(): Promise<void> {
    if (this.model && this.featureExtractor) return;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      const m = await AutoModel.from_pretrained(MODEL_ID, { dtype: "fp32" });
      const fe = await AutoFeatureExtractor.from_pretrained(MODEL_ID);
      this.model = m;
      this.featureExtractor = fe;
      this.logger.log("Speaker embedding model loaded");
    })();

    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  async processVoiceSample(userId: string, audioBuffer: Buffer): Promise<VoiceComparisonResult> {
    const pcm = await this.decodeAudio(audioBuffer);
    const embedding = await this.extractEmbedding(pcm);
    if (!embedding) {
      this.logger.warn("Failed to extract embedding for user " + userId);
      return { status: "match" };
    }

    const stored = await this.voicePrintRepository.findByUser(userId);

    if (!stored || stored.sampleCount < ENROLLMENT_SAMPLES) {
      return this.enroll(userId, embedding, stored);
    }

    return this.compare(embedding, stored.embedding as number[]);
  }

  private async decodeAudio(buffer: Buffer): Promise<Float32Array> {
    const { read_audio } = await import("@huggingface/transformers");
    const tmpPath = join(tmpdir(), `voice-sample-${randomUUID()}.webm`);
    try {
      writeFileSync(tmpPath, buffer);
      return await read_audio(tmpPath, 16000);
    } finally {
      try { unlinkSync(tmpPath); } catch { /* ignore cleanup errors */ }
    }
  }

  private async extractEmbedding(pcm: Float32Array): Promise<number[] | null> {
    try {
      await this.ensureLoaded();
      if (!this.featureExtractor || !this.model) throw new Error("Model not loaded");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- transformers.js returns untyped tensors
      const inputs = await this.featureExtractor(pcm);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- untyped tensor input
      const output = await this.model(inputs);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- accessing tensor property
      const embeddings = output.last_hidden_state;
      if (!this.dimLogged) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- tensor dims
        this.logger.log(`Speaker embedding dims: [${embeddings.dims}], total: ${embeddings.data.length}`);
        this.dimLogged = true;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- tensor data
      return Array.from(embeddings.data as Float32Array);
    } catch (error) {
      this.logger.error(`Embedding extraction failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async enroll(
    userId: string,
    newEmbedding: number[],
    stored: { embedding: number[] | null; sampleCount: number } | null,
  ): Promise<VoiceComparisonResult> {
    const count = (stored?.sampleCount ?? 0) + 1;
    let averaged: number[];

    if (stored?.embedding) {
      averaged = stored.embedding.map((v, i) => v + (((newEmbedding[i] ?? 0) - v) / count));
    } else {
      averaged = newEmbedding;
    }

    await this.voicePrintRepository.upsert(userId, averaged, count);
    this.logger.log(`Voice enrollment ${count}/${ENROLLMENT_SAMPLES} for user ${userId}`);

    return { status: "enrolling", samplesCollected: count };
  }

  private compare(embedding: number[], storedEmbedding: number[]): VoiceComparisonResult {
    const similarity = this.cosineSimilarity(embedding, storedEmbedding);
    this.logger.debug(`Voice similarity: ${similarity.toFixed(3)}`);

    return {
      status: similarity >= SIMILARITY_THRESHOLD ? "match" : "mismatch",
      similarity,
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (const [i, av] of a.entries()) {
      const bv = b[i] ?? 0;
      dot += av * bv;
      normA += av * av;
      normB += bv * bv;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
