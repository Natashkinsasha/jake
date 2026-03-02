import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EnvSchema } from "./env.schema";
import { EnvService } from "./env.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => EnvSchema.parse(config),
    }),
  ],
  providers: [EnvService],
  exports: [EnvService],
})
export class SharedConfigModule {}
