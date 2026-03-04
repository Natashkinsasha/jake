import { Module } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicModule } from "../../@lib/anthropic/src";
import { SharedConfigModule } from "../shared-config/shared-config.module";
import { EnvService } from "../shared-config/env.service";

@Module({
  imports: [
    AnthropicModule.forRootAsync({
      imports: [SharedConfigModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => {
        return new Anthropic({ apiKey: env.get("ANTHROPIC_API_KEY"), maxRetries: 2 });
      },
    }),
  ],
  exports: [AnthropicModule],
})
export class SharedAnthropicModule {}
