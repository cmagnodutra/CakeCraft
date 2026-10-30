import {
  CallHandler,
  ExecutionContext,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { of, throwError } from 'rxjs';
import { lastValueFrom } from 'rxjs';

import { AppEnvironment } from '../config/env.validation';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

function makeConfig(metricsToken?: string): ConfigService<Partial<AppEnvironment>> {
  return {
    get: jest.fn((key: string) => (key === 'METRICS_TOKEN' ? metricsToken : undefined)),
  } as unknown as ConfigService<Partial<AppEnvironment>>;
}

function makeHttpContext(
  method: string,
  url: string,
  statusCode = 200,
): ExecutionContext {
  const req = { method, originalUrl: url, url };
  const res = { statusCode };
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

describe('Observabilidade Prometheus - MetricsModule (RNF01 / RNF07)', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('normaliza UUIDs e nomes de upload na rota para evitar explosao de cardinalidade', () => {
    expect(
      service.normalizeRoute(
        '/api/orders/abcdef12-3456-4789-8000-111111111111/cancel?origem=web',
      ),
    ).toBe('/api/orders/:id/cancel');

    expect(
      service.normalizeRoute(
        '/api/uploads/rice-paper/11111111-1111-4111-8111-111111111111.png',
      ),
    ).toBe('/api/uploads/rice-paper/:file');
  });

  it('expoe metricas de processo Node.js, histograma HTTP (bucket 0.5s RNF01) e contadores de negocio', async () => {
    service.recordHttpRequest('POST', '/api/pricing/calculate', 200, 0.042);
    service.recordOrderCreated();
    service.recordPixWebhook('PAYMENT_CONFIRMED');

    const body = await service.getMetricsSnapshot();

    expect(body).toContain('cakecraft_nodejs_version_info');
    expect(body).toContain(
      'cakecraft_http_requests_total{method="POST",route="/api/pricing/calculate",status_code="200"} 1',
    );
    expect(body).toContain(
      'cakecraft_http_request_duration_seconds_bucket{le="0.5",method="POST",route="/api/pricing/calculate",status_code="200"} 1',
    );
    expect(body).toContain('cakecraft_orders_created_total 1');
    expect(body).toContain(
      'cakecraft_pix_webhooks_processed_total{event="PAYMENT_CONFIRMED"} 1',
    );
  });

  it('MetricsController entrega texto Prometheus sem token em rede interna e exige Bearer quando METRICS_TOKEN esta definido', async () => {
    const setHeaderMock = jest.fn();
    const sendMock = jest.fn();
    const res = {
      setHeader: setHeaderMock,
      send: sendMock,
    } as unknown as Response;

    const openController = new MetricsController(service, makeConfig(undefined));
    await openController.getMetrics(undefined, res);
    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', service.getContentType());
    expect(sendMock).toHaveBeenCalledTimes(1);

    const protectedController = new MetricsController(
      service,
      makeConfig('segredo-prometheus-123456'),
    );

    await expect(protectedController.getMetrics(undefined, res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      protectedController.getMetrics('Bearer token-incorreto-123', res),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await protectedController.getMetrics('Bearer segredo-prometheus-123456', res);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('HttpMetricsInterceptor registra sucesso, HttpException (422) e erro inesperado (500), ignorando /api/metrics e WebSockets', async () => {
    const interceptor = new HttpMetricsInterceptor(service);
    const okNext: CallHandler = { handle: () => of({ ok: true }) };

    // Contexto nao-HTTP (ex.: WebSocket) passa direto sem gravar metrica HTTP
    const wsCtx = { getType: () => 'ws' } as unknown as ExecutionContext;
    await lastValueFrom(interceptor.intercept(wsCtx, okNext));

    // Scrape em /api/metrics nao polui o histograma da aplicacao
    await lastValueFrom(
      interceptor.intercept(makeHttpContext('GET', '/api/metrics', 200), okNext),
    );

    // Requisicao 200 com UUID normalizado
    await lastValueFrom(
      interceptor.intercept(
        makeHttpContext(
          'GET',
          '/api/orders/abcdef12-3456-4789-8000-111111111111',
          200,
        ),
        okNext,
      ),
    );

    // Excecao de negocio 422 (ex.: RN01 massa aerada > 2 andares)
    const err422Next: CallHandler = {
      handle: () => throwError(() => new UnprocessableEntityException('RN01')),
    };
    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeHttpContext('POST', '/api/pricing/calculate', 200),
          err422Next,
        ),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    // Erro inesperado 500
    const err500Next: CallHandler = {
      handle: () => throwError(() => new Error('falha inesperada')),
    };
    await expect(
      lastValueFrom(
        interceptor.intercept(makeHttpContext('GET', '/api/catalog', 200), err500Next),
      ),
    ).rejects.toThrow('falha inesperada');

    const snapshot = await service.getMetricsSnapshot();
    expect(snapshot).not.toContain('route="/api/metrics"');
    expect(snapshot).toContain(
      'cakecraft_http_requests_total{method="GET",route="/api/orders/:id",status_code="200"} 1',
    );
    expect(snapshot).toContain(
      'cakecraft_http_requests_total{method="POST",route="/api/pricing/calculate",status_code="422"} 1',
    );
    expect(snapshot).toContain(
      'cakecraft_http_requests_total{method="GET",route="/api/catalog",status_code="500"} 1',
    );
  });
});
