import { Module } from "@nestjs/common";
import { EmbeddingService } from "./embedding.service";
import { SharedOpenaiModule } from "../../../@shared/shared-openai/shared-openai.module";

@Module({
  imports: [SharedOpenaiModule],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
