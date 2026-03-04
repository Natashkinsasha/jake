import { Inject, Injectable, Logger } from "@nestjs/common";
import OpenAI from "openai";
import { OPENAI_CLIENT } from "../../../@lib/openai/src";

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(@Inject(OPENAI_CLIENT) private client: OpenAI) {}

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      const embedding = response.data[0];
      if (!embedding) throw new Error("OpenAI returned no embeddings");
      return embedding.embedding;
    } catch (error) {
      this.logger.error(`OpenAI embedding failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
