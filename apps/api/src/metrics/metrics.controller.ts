import { timingSafeEqual } from 'node:crypto';

import {
  Controller,
  Get,
  Headers,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';

import { AppEnvironment } from '../config/env.validation';
import { MetricsService } from './metrics.service';

@Controller('metrics')
@SkipThrottle()
export class MetricsController {
  private readonly expectedToken?: string;

  constructor(
    private readonly metricsService: MetricsService,
    config: ConfigService<Partial<AppEnvironment>>,
  ) {
    this.expectedToken = config.get('METRICS_TOKEN', { infer: true });
  }

  /**
   * Endpoint de scraping do Prometheus (/api/metrics).
   * Na topologia Docker de producao, o Caddy bloqueia acesso externo a esta
   * rota e o Prometheus coleta diretamente na rede interna; opcionalmente,
   * METRICS_TOKEN ativa autenticacao Bearer em tempo constante.
   */
  @Get()
  async getMetrics(
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (this.expectedToken) {
      const prefix = 'Bearer ';
      const candidate =
        authorization && authorization.startsWith(prefix)
          ? authorization.slice(prefix.length).trim()
          : '';

      if (!this.safeEquals(candidate, this.expectedToken)) {
        throw new UnauthorizedException('Token de scraping Prometheus invalido.');
      }
    }

    const payload = await this.metricsService.getMetricsSnapshot();
    res.setHeader('Content-Type', this.metricsService.getContentType());
    res.send(payload);
  }

  private safeEquals(received: string, expected: string): boolean {
    const a = Buffer.from(received, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length === 0 || a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  }
}
