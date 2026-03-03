import { Catch, ArgumentsHost, HttpException, Logger } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";

@Catch()
export class HttpExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== "http") {
      super.catch(exception, host);
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === "string"
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message;

      if (status >= 500) {
        this.logger.error(`[${status}] ${message}`, exception.stack);
      }

      response.status(status).json({
        statusCode: status,
        error: exception.name,
        message,
      });
      return;
    }

    this.logger.error(
      `Unhandled exception: ${exception instanceof Error ? exception.message : exception}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  }
}
