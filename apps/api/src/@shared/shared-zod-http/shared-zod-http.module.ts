import { Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "./zod-validation.pipe";
import { ZodExceptionFilter } from "./zod-exception.filter";

@Global()
@Module({
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ZodExceptionFilter },
  ],
})
export class SharedZodHttpModule {}
