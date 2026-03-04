import { Module } from "@nestjs/common";
import { ClsModule } from "nestjs-cls";
import OpenAI from "openai";
import { OpenAiEmbeddingProvider } from "./openai-embedding.provider";
import { SharedOpenaiModule } from "../../../@shared/shared-openai/shared-openai.module";
import { OPENAI_CLIENT } from "../../../@lib/openai/src";
import { EmbeddingProvider } from "../../../@lib/provider/src";

@Module({
  imports: [
    ClsModule.forFeatureAsync({
      imports: [SharedOpenaiModule],
      provide: EmbeddingProvider,
      inject: [OPENAI_CLIENT],
      useFactory: (client: OpenAI) => new OpenAiEmbeddingProvider(client),
    }),
  ],
  exports: [ClsModule],
})
export class EmbeddingModule {}
