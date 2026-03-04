import { Module } from "@nestjs/common";
import { OpenAiEmbeddingProvider } from "./openai-embedding.provider";
import { SharedOpenaiModule } from "../../../@shared/shared-openai/shared-openai.module";

@Module({
  imports: [SharedOpenaiModule],
  providers: [OpenAiEmbeddingProvider],
  exports: [OpenAiEmbeddingProvider],
})
export class EmbeddingModule {}
