import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

const UUID_SEGMENT_REGEX =
  /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;
const UPLOAD_FILE_SEGMENT_REGEX =
  /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$/i;

/**
 * Servico de observabilidade Prometheus (requisito do nucleo comum de
 * engenharia + monitoramento continuo de RNF01 <= 500ms e RNF07 >= 99,5%).
 *
 * Mantem um Registry isolado por instancia para suportar multiplos boots do
 * AppModule na suite de integracao/E2E sem colisao de nomes no registro global.
 */
@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly registry: Registry;
  private readonly httpRequestsTotal: Counter<'method' | 'route' | 'status_code'>;
  private readonly httpRequestDurationSeconds: Histogram<
    'method' | 'route' | 'status_code'
  >;
  private readonly ordersCreatedTotal: Counter;
  private readonly pixWebhooksProcessedTotal: Counter<'event'>;

  constructor() {
    this.registry = new Registry();

    collectDefaultMetrics({
      register: this.registry,
      prefix: 'cakecraft_',
    });

    this.httpRequestsTotal = new Counter({
      name: 'cakecraft_http_requests_total',
      help: 'Total de requisicoes HTTP processadas pela API CakeCraft',
      labelNames: ['method', 'route', 'status_code'] as const,
      registers: [this.registry],
    });

    // Inclui explicitamente o bucket 0.5s para auditar o SLA RNF01 (<= 500ms
    // no motor de precificacao /api/pricing/calculate) diretamente no Grafana.
    this.httpRequestDurationSeconds = new Histogram({
      name: 'cakecraft_http_request_duration_seconds',
      help: 'Duracao das requisicoes HTTP em segundos',
      labelNames: ['method', 'route', 'status_code'] as const,
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.ordersCreatedTotal = new Counter({
      name: 'cakecraft_orders_created_total',
      help: 'Total de pedidos customizados criados com sucesso (UC01)',
      registers: [this.registry],
    });

    this.pixWebhooksProcessedTotal = new Counter({
      name: 'cakecraft_pix_webhooks_processed_total',
      help: 'Total de eventos de webhook PIX Asaas processados por tipo (RN03)',
      labelNames: ['event'] as const,
      registers: [this.registry],
    });
  }

  normalizeRoute(rawUrl: string): string {
    const withoutQuery = rawUrl.split('?')[0] || '/';
    return withoutQuery
      .replace(UPLOAD_FILE_SEGMENT_REGEX, '/:file')
      .replace(UUID_SEGMENT_REGEX, '/:id');
  }

  recordHttpRequest(
    method: string,
    rawRoute: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = {
      method: method.toUpperCase(),
      route: this.normalizeRoute(rawRoute),
      status_code: String(statusCode),
    };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  recordOrderCreated(): void {
    this.ordersCreatedTotal.inc();
  }

  recordPixWebhook(event: string): void {
    this.pixWebhooksProcessedTotal.inc({ event });
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  async getMetricsSnapshot(): Promise<string> {
    return this.registry.metrics();
  }

  onModuleDestroy(): void {
    this.registry.clear();
  }
}
