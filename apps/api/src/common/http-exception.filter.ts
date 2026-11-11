import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const raw = typeof body === "string" ? body : (body as { message?: string | string[] }).message;
      const message = Array.isArray(raw) ? raw.join("; ") : raw || exception.message;
      response.status(exception.getStatus()).json({ message });
      return;
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Unexpected server error." });
  }
}
