import { Module } from "@nestjs/common";
import { EmbeddingService } from "./embedding.service";
import { SharedConfigModule } from "../../../@shared/shared-config/shared-config.module";

@Module({
  imports: [SharedConfigModule],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
