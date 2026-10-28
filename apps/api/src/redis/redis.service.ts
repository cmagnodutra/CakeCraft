import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { AppEnvironment } from '../config/env.validation';

/**
 * Cliente Redis compartilhado para cache de alta frequencia (catalogo de
 * ingredientes) e operacoes auxiliares. Configurado com lazyConnect e sem fila
 * offline para degradar imediatamente ao PostgreSQL caso o Redis esteja
 * indisponivel, sem travar requisicoes HTTP.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;

  constructor(config: ConfigService<Partial<AppEnvironment>>) {
    const redisUrl = config.get('REDIS_URL', { infer: true });

    if (!redisUrl) {
      this.client = null;
      return;
    }

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    this.client.on('error', (err: Error) => {
      this.logger.warn(`Evento de erro no cliente Redis: ${err.message}`);
    });
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client) {
      return null;
    }

    try {
      const raw = await this.client.get(key);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        `Falha ao ler chave '${key}' do Redis (fallback ao PostgreSQL): ${this.describeError(error)}`,
      );
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `Falha ao gravar chave '${key}' no Redis: ${this.describeError(error)}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(
        `Falha ao invalidar chave '${key}' no Redis: ${this.describeError(error)}`,
      );
    }
  }

  async flushDb(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.flushdb();
    } catch (error) {
      this.logger.warn(`Falha ao limpar banco Redis: ${this.describeError(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    if (this.client.status === 'wait' || this.client.status === 'end') {
      this.client.disconnect();
      return;
    }

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
