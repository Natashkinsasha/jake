import { Module } from "@nestjs/common";
import { APP_PIPE, APP_INTERCEPTOR } from "@nestjs/core";
import { ZodValidationPipe, ZodSerializerInterceptor } from "nestjs-zod";
import { HttpExceptionFilter } from "./http-exception.filter";

@Module({
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    HttpExceptionFilter,
  ],
  exports: [HttpExceptionFilter],
})
export class SharedZodHttpModule {}
