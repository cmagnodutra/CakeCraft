import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const rawUrl = req.originalUrl || req.url || '/';
    const normalized = this.metricsService.normalizeRoute(rawUrl);

    if (normalized === '/api/metrics') {
      return next.handle();
    }

    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationSeconds =
            Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
          this.metricsService.recordHttpRequest(
            req.method,
            normalized,
            res.statusCode || HttpStatus.OK,
            durationSeconds,
          );
        },
        error: (err: unknown) => {
          const durationSeconds =
            Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
          const status =
            err instanceof HttpException
              ? err.getStatus()
              : HttpStatus.INTERNAL_SERVER_ERROR;
          this.metricsService.recordHttpRequest(
            req.method,
            normalized,
            status,
            durationSeconds,
          );
        },
      }),
    );
  }
}
