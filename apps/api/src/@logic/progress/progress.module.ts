import { Module } from "@nestjs/common";
import { SharedDrizzlePgModule } from "@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { ProgressContract } from "./contract/progress.contract";
import { GrammarProgressRepository } from "./infrastructure/repository/grammar-progress.repository";

@Module({
  imports: [SharedDrizzlePgModule],
  providers: [GrammarProgressRepository, ProgressContract],
  exports: [ProgressContract],
})
export class ProgressModule {}
