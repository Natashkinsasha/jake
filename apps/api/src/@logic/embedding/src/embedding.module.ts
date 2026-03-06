import { Module } from "@nestjs/common";
import OpenAI from "openai";
import { SharedOpenaiModule } from "@shared/shared-openai/shared-openai.module";
import { OPENAI_CLIENT } from "@lib/openai/src";
import { EmbeddingProvider } from "@lib/provider/src";
import { OpenAiEmbeddingProvider } from "./openai-embedding.provider";

@Module({
  imports: [SharedOpenaiModule],
  providers: [
    {
      provide: EmbeddingProvider,
      inject: [OPENAI_CLIENT],
      useFactory: (client: OpenAI) => new OpenAiEmbeddingProvider(client),
    },
  ],
  exports: [EmbeddingProvider],
})
export class EmbeddingModule {}
