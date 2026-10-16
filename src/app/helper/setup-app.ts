import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import config from '../config';
import { GlobalExceptionFilter } from './globalerror.filter';
import { UtilsInterceptor } from '../utils/utils.interceptor';

// Shared by the real server and HTTP tests so they use the same validation.
export function setupApp(app: INestApplication) {
  app.enableShutdownHooks();
  app.use(cookieParser());
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.locals.requestId = randomUUID();
    res.setHeader('X-Request-Id', res.locals.requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.enableCors({ origin: config.frontendUrl, credentials: true });
  app.setGlobalPrefix('api/v1', { exclude: [''] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new UtilsInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(HttpAdapterHost)));
}
