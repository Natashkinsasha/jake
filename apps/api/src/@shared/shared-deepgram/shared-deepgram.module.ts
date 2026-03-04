import { Module } from "@nestjs/common";
import { createClient } from "@deepgram/sdk";
import { DeepgramModule } from "../../@lib/deepgram/src";
import { SharedConfigModule } from "../shared-config/shared-config.module";
import { EnvService } from "../shared-config/env.service";

@Module({
  imports: [
    DeepgramModule.forRootAsync({
      imports: [SharedConfigModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => {
        return createClient(env.get("DEEPGRAM_API_KEY"));
      },
    }),
  ],
  exports: [DeepgramModule],
})
export class SharedDeepgramModule {}
