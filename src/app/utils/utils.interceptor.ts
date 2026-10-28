import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { catchError, map, Observable, throwError } from 'rxjs';
import { moneyResponse } from '../helper/money-response';

@Injectable()
export class UtilsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((response) => {
        if (
          response &&
          typeof response === 'object' &&
          ('data' in response || 'message' in response)
        ) {
          return {
            statusCode: res.statusCode,
            success: res.statusCode >= 200 && res.statusCode < 300,
            message: response.message || null,
            meta: response.meta,
            data: moneyResponse(response.data),
          };
        }

        return {
          statusCode: res.statusCode,
          success: res.statusCode >= 200 && res.statusCode < 300,
          message: 'Request successfully completed',
          data: moneyResponse(response),
        };
      }),
      catchError((error) => throwError(() => error)),
    );
  }
}
