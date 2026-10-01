import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Domain error with a stable machine-readable code. The exception filter turns
 * it into `{ statusCode, code, message, details? }`. Clients branch on `code`.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super({ statusCode: status, code, message, details }, status);
  }
}

export const Errors = {
  notFound: (code: string, message = 'Resource not found') => new AppException(HttpStatus.NOT_FOUND, code, message),
  badRequest: (code: string, message: string, details?: unknown) =>
    new AppException(HttpStatus.BAD_REQUEST, code, message, details),
  conflict: (code: string, message: string, details?: unknown) =>
    new AppException(HttpStatus.CONFLICT, code, message, details),
  forbidden: (code: string, message: string) => new AppException(HttpStatus.FORBIDDEN, code, message),
  unauthorized: (code: string, message = 'Authentication required') =>
    new AppException(HttpStatus.UNAUTHORIZED, code, message),
  unprocessable: (code: string, message: string, details?: unknown) =>
    new AppException(HttpStatus.UNPROCESSABLE_ENTITY, code, message, details),
  tooManyRequests: (code: string, message: string) => new AppException(HttpStatus.TOO_MANY_REQUESTS, code, message),
};
