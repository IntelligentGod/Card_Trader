import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody } from '@card-trader/shared';
import type { Response } from 'express';
import { AppException } from '../errors/app.exception';

const STATUS_CODES: Partial<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
};

/**
 * Single error shape for every failure. Internal errors (Prisma, bugs) are
 * logged server-side and never leak details to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof AppException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        ...(exception.details === undefined ? {} : { details: exception.details }),
      };
    }

    if (exception instanceof ThrottlerException) {
      return { statusCode: 429, code: 'RATE_LIMITED', message: 'Too many requests, slow down' };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      // ValidationPipe produces { message: string[] }
      if (status === HttpStatus.BAD_REQUEST && typeof res === 'object' && Array.isArray((res as { message?: unknown }).message)) {
        return {
          statusCode: status,
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
          details: (res as { message: string[] }).message,
        };
      }
      const message = typeof res === 'string' ? res : ((res as { message?: string }).message ?? exception.message);
      return { statusCode: status, code: STATUS_CODES[status] ?? 'HTTP_ERROR', message: String(message) };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { statusCode: 409, code: 'CONFLICT', message: 'Resource already exists' };
      }
      if (exception.code === 'P2025') {
        return { statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found' };
      }
      if (exception.code === 'P2003') {
        return { statusCode: 409, code: 'CONFLICT', message: 'Related resource constraint failed' };
      }
    }

    this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Something went wrong' };
  }
}
