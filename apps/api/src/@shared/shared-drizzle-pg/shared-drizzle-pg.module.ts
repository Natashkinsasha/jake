import { Module } from "@nestjs/common";
import { SharedConfigModule } from "../shared-config/shared-config.module";
import { drizzleProvider, DRIZZLE } from "./drizzle.provider";

@Module({
  imports: [SharedConfigModule],
  providers: [drizzleProvider],
  exports: [DRIZZLE],
})
export class SharedDrizzlePgModule {}
