import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request, Response } from 'express';

import { ValidationError } from 'class-validator';
import { MulterError } from 'multer';
import {
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError,
} from '@nestjs/jwt';

import config from '../config';
import { handleClassValidatorErrors } from '../errors/classValidatorErrors';
import { handleHttpException } from '../errors/httpException';
import { handleMulterError } from '../errors/multerError';
import {
  handleCloudinaryError,
  isCloudinaryError,
} from '../errors/cloudinaryError';
import { handlePrismaError } from '../errors/prismaerror';
import { handleJwtError } from '../errors/jwtError';
import { handleSyntaxError } from '../errors/syntaxError';
import { handleProgrammerError } from '../errors/programmerError';
import { TErrorResponse, TErrorSource } from '../interface/error.interface';
import { Prisma } from '../../../prisma/generated/prisma/client';

// ── Helper: detect any Prisma error ──────────────────────────────────────────
function isPrismaError(
  err: unknown,
): err is
  | Prisma.PrismaClientKnownRequestError
  | Prisma.PrismaClientValidationError
  | Prisma.PrismaClientUnknownRequestError
  | Prisma.PrismaClientInitializationError
  | Prisma.PrismaClientRustPanicError {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  );
}

// ── Filter ────────────────────────────────────────────────────────────────────
@Catch()
export class GlobalExceptionFilter<T> implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(err: T, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const isDev = config.env === 'development';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong!';
    let errorSources: TErrorSource[] = [
      { path: '', message: 'Something went wrong' },
    ];

    // 1️  Raw class-validator ValidationError[]
    if (
      Array.isArray(err) &&
      err.length > 0 &&
      err[0] instanceof ValidationError
    ) {
      statusCode = HttpStatus.BAD_REQUEST;
      ({ message, errorSources } = handleClassValidatorErrors(
        err as ValidationError[],
      ));
    }

    // 2️  NestJS HttpException
    else if (err instanceof HttpException) {
      const res = err.getResponse() as any;
      if (
        typeof res === 'object' &&
        Array.isArray(res.message) &&
        res.message[0] instanceof ValidationError
      ) {
        statusCode = err.getStatus();
        ({ message, errorSources } = handleClassValidatorErrors(
          res.message as ValidationError[],
        ));
      } else {
        ({ statusCode, message, errorSources } = handleHttpException(err));
      }
    }

    // 3️  Multer Error
    else if (err instanceof MulterError) {
      ({ statusCode, message, errorSources } = handleMulterError(err));
    }

    // 4️  Cloudinary Error
    else if (isCloudinaryError(err)) {
      ({ statusCode, message, errorSources } = handleCloudinaryError(err));
    }

    // Prisma database errors
    else if (isPrismaError(err)) {
      ({ statusCode, message, errorSources } = handlePrismaError(err));
    }

    // JWT errors
    else if (
      err instanceof TokenExpiredError ||
      err instanceof NotBeforeError ||
      err instanceof JsonWebTokenError
    ) {
      ({ statusCode, message, errorSources } = handleJwtError(err));
    }

    // Invalid JSON body
    else if (err instanceof SyntaxError && 'body' in err) {
      ({ statusCode, message, errorSources } = handleSyntaxError(err));
    }

    // TypeError / RangeError
    else if (err instanceof TypeError || err instanceof RangeError) {
      ({ statusCode, message, errorSources } = handleProgrammerError(err));
    }

    // Other errors
    else if (err instanceof Error) {
      message = err.message;
      errorSources = [{ path: '', message: err.message }];
    }

    // Never log request bodies, cookies, tokens or query strings.
    const details = {
      requestId: response.locals.requestId,
      method: request.method,
      path: request.path,
      statusCode,
      errorType: err instanceof Error ? err.name : 'UnknownError',
    };
    if (statusCode >= 500) {
      this.logger.error(
        details,
        isDev && err instanceof Error ? err.stack : undefined,
      );
      if (!isDev) {
        message = 'An unexpected error occurred. Please try again later.';
        errorSources = [{ path: '', message }];
      }
    } else {
      this.logger.warn(details);
    }

    const body: TErrorResponse = {
      success: false,
      statusCode,
      message,
      errorSources,
      stack: isDev && err instanceof Error ? err.stack : null,
    };

    httpAdapter.reply(response, body, statusCode);
  }
}
