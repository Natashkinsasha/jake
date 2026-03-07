import { Module } from "@nestjs/common";
import { SharedDrizzlePgModule } from "@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { SharedAuthModule } from "@shared/shared-auth/shared-auth.module";
import { VocabularyRepository } from "./infrastructure/repository/vocabulary.repository";
import { VocabularyContract } from "./contract/vocabulary.contract";
import { VocabularyController } from "./presentation/controller/vocabulary.controller";

@Module({
  imports: [SharedDrizzlePgModule, SharedAuthModule],
  controllers: [VocabularyController],
  providers: [VocabularyRepository, VocabularyContract],
  exports: [VocabularyContract],
})
export class VocabularyModule {}
