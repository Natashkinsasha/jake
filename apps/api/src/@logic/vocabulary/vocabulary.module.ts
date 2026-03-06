import { Module } from "@nestjs/common";
import { SharedDrizzlePgModule } from "../../@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { VocabularyRepository } from "./infrastructure/repository/vocabulary.repository";
import { VocabularyContract } from "./contract/vocabulary.contract";

@Module({
  imports: [SharedDrizzlePgModule],
  providers: [VocabularyRepository, VocabularyContract],
  exports: [VocabularyContract],
})
export class VocabularyModule {}
