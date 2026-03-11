import { Module } from "@nestjs/common";
import { SharedAuthModule } from "@shared/shared-auth/shared-auth.module";
import { SharedDrizzlePgModule } from "@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { VocabularyContract } from "./contract/vocabulary.contract";
import { VocabularyRepository } from "./infrastructure/repository/vocabulary.repository";
import { VocabularyController } from "./presentation/controller/vocabulary.controller";

@Module({
  imports: [SharedDrizzlePgModule, SharedAuthModule],
  controllers: [VocabularyController],
  providers: [VocabularyRepository, VocabularyContract],
  exports: [VocabularyContract],
})
export class VocabularyModule {}
