import { Module } from "@nestjs/common";
import { ClsModule } from "nestjs-cls";
import { OpenAiEmbeddingProvider } from "./openai-embedding.provider";
import { SharedOpenaiModule } from "../../../@shared/shared-openai/shared-openai.module";
import { EmbeddingProvider } from "../../../@lib/provider/src";

@Module({
  imports: [
    SharedOpenaiModule,
    ClsModule.forFeatureAsync({
      provide: EmbeddingProvider,
      inject: [OpenAiEmbeddingProvider],
      useFactory: (openai: OpenAiEmbeddingProvider) => openai,
    }),
  ],
  providers: [OpenAiEmbeddingProvider],
  exports: [EmbeddingProvider],
})
export class EmbeddingModule {}
