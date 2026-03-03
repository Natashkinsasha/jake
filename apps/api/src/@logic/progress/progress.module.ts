import { Module } from "@nestjs/common";
import { GrammarProgressRepository } from "./infrastructure/repository/grammar-progress.repository";
import { ProgressContract } from "./contract/progress.contract";
import { SharedDrizzlePgModule } from "../../@shared/shared-drizzle-pg/shared-drizzle-pg.module";

@Module({
  imports: [SharedDrizzlePgModule],
  providers: [GrammarProgressRepository, ProgressContract],
  exports: [ProgressContract],
})
export class ProgressModule {}
