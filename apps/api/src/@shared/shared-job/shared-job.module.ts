import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EnvService } from "../shared-config/env.service";
import { SharedConfigModule } from "../shared-config/shared-config.module";

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 200,
};

@Module({
  imports: [
    SharedConfigModule,
    BullModule.forRootAsync({
      imports: [SharedConfigModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        connection: {
          host: new URL(env.get("REDIS_URL")).hostname,
          port: Number(new URL(env.get("REDIS_URL")).port) || 6379,
        },
        defaultJobOptions,
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
