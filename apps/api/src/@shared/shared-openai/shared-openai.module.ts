import { OpenaiModule } from "@lib/openai/src";
import { Module } from "@nestjs/common";
import OpenAI from "openai";
import { EnvService } from "../shared-config/env.service";
import { SharedConfigModule } from "../shared-config/shared-config.module";

@Module({
  imports: [
    OpenaiModule.forRootAsync({
      imports: [SharedConfigModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => {
        return new OpenAI({ apiKey: env.get("OPENAI_API_KEY") });
      },
    }),
  ],
  exports: [OpenaiModule],
})
export class SharedOpenaiModule {}
