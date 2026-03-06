import { Module } from "@nestjs/common";
import { SharedDrizzlePgModule } from "../../@shared/shared-drizzle-pg/shared-drizzle-pg.module";
import { GrammarProgressRepository } from "./infrastructure/repository/grammar-progress.repository";
import { ProgressContract } from "./contract/progress.contract";

@Module({
  imports: [SharedDrizzlePgModule],
  providers: [GrammarProgressRepository, ProgressContract],
  exports: [ProgressContract],
})
export class ProgressModule {}
