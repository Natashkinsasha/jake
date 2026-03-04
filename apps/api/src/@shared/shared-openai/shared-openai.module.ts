import { Module } from "@nestjs/common";
import OpenAI from "openai";
import { OpenaiModule } from "../../@lib/openai/src";
import { SharedConfigModule } from "../shared-config/shared-config.module";
import { EnvService } from "../shared-config/env.service";

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
