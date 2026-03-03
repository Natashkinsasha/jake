import { Injectable, Logger } from "@nestjs/common";
import OpenAI from "openai";
import { EnvService } from "../../../@shared/shared-config/env.service";

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private client: OpenAI;

  constructor(private env: EnvService) {
    this.client = new OpenAI({ apiKey: env.get("OPENAI_API_KEY") });
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(`OpenAI embedding failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }
}
