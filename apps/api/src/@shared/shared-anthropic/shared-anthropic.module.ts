import Anthropic from "@anthropic-ai/sdk";
import { AnthropicModule } from "@lib/anthropic/src";
import { Module } from "@nestjs/common";
import { EnvService } from "../shared-config/env.service";
import { SharedConfigModule } from "../shared-config/shared-config.module";

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
