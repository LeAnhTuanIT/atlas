import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  DomainException,
  ConflictException,
  InvalidArgumentException,
} from '../../domain/exceptions/domain.exception';
import { NotFoundException } from '../../domain/exceptions/not-found.exception';
import { CORRELATION_ID_HEADER } from '../middlewares/correlation-id.middleware';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'Đã có lỗi hệ thống xảy ra';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;

      errorCode =
        res.error || (status === 401 ? 'UNAUTHORIZED' : 'HTTP_EXCEPTION');
      message = Array.isArray(res.message)
        ? res.message[0]
        : res.message || exception.message;
      details = Array.isArray(res.message)
        ? res.message
        : typeof res === 'object' && res.message
          ? null
          : res;
    } else if (exception instanceof DomainException) {
      errorCode = exception.code;
      message = exception.message;

      if (exception instanceof NotFoundException) {
        status = HttpStatus.NOT_FOUND;
      } else if (exception instanceof ConflictException) {
        status = HttpStatus.CONFLICT;
      } else if (exception instanceof InvalidArgumentException) {
        status = HttpStatus.BAD_REQUEST;
      } else {
        status = HttpStatus.UNPROCESSABLE_ENTITY;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Đảm bảo lấy được correlation ID kể cả viết hoa hay thường
    const headerKey = (
      CORRELATION_ID_HEADER || 'x-correlation-id'
    ).toLowerCase();
    const correlationId =
      (request.headers[headerKey] as string) ||
      (request.headers['x-correlation-id'] as string) ||
      null;

    this.logger.error(
      `[${request.method}] ${request.url} | Status: ${status} | Code: ${errorCode} | Msg: ${message} | Correlation: ${correlationId}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      errorCode,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
    });
  }
}
