import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EnvService } from "../shared-config/env.service";

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        connection: {
          host: new URL(env.get("REDIS_URL")).hostname,
          port: Number(new URL(env.get("REDIS_URL")).port) || 6379,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: "post-lesson" },
      { name: "fact-extraction" },
      { name: "homework-generation" },
      { name: "review-reminder" },
    ),
  ],
  exports: [BullModule],
})
export class SharedJobModule {}
