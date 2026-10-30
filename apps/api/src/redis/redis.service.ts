import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { AppEnvironment } from '../config/env.validation';

export const ORDER_EVENTS_CHANNEL = 'cakecraft:orders:events:v1';

export interface OrderRealtimeEvent {
  type: 'ORDER_PAID' | 'ORDER_STATUS_UPDATED' | 'ORDER_CANCELLED';
  orderId: string;
  userId: string;
  status: string;
  updatedAt: string;
}

type JsonSubscriber = (payload: unknown) => void;

/**
 * Cliente Redis compartilhado para cache de alta frequencia (catalogo de
 * ingredientes) e mensageria Pub/Sub de eventos de dominio (Secao 5.3 / 5.4 do
 * RFC: desacoplamento entre Pagamentos, Kanban e WebSockets).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;
  private readonly isProduction: boolean;
  private subscriber: Redis | null = null;
  private readonly handlers = new Map<string, Set<JsonSubscriber>>();

  constructor(config: ConfigService<Partial<AppEnvironment>>) {
    const redisUrl = config.get('REDIS_URL', { infer: true });
    this.isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

    if (!redisUrl) {
      this.client = null;
      return;
    }

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: this.isProduction ? 3000 : 500,
      retryStrategy: this.isProduction
        ? (times: number) => Math.min(times * 200, 2000)
        : () => null,
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
      await this.ensureConnected(this.client);
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
      await this.ensureConnected(this.client);
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
      await this.ensureConnected(this.client);
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(
        `Falha ao invalidar chave '${key}' no Redis: ${this.describeError(error)}`,
      );
    }
  }

  async publishJson(channel: string, payload: unknown): Promise<void> {
    if (!this.client) {
      this.dispatchLocal(channel, payload);
      return;
    }

    try {
      await this.ensureConnected(this.client);
      await this.client.publish(channel, JSON.stringify(payload));
    } catch (error) {
      this.logger.warn(
        `Falha ao publicar no canal Redis '${channel}' (entregando localmente): ${this.describeError(error)}`,
      );
      this.dispatchLocal(channel, payload);
    }
  }

  async subscribeJson<T>(channel: string, handler: (payload: T) => void): Promise<void> {
    let channelHandlers = this.handlers.get(channel);
    const isFirstForChannel = !channelHandlers;
    if (!channelHandlers) {
      channelHandlers = new Set<JsonSubscriber>();
      this.handlers.set(channel, channelHandlers);
    }
    channelHandlers.add((raw) => handler(raw as T));

    if (!this.client || !isFirstForChannel) {
      return;
    }

    try {
      if (!this.subscriber) {
        this.subscriber = this.client.duplicate({
          lazyConnect: true,
          enableOfflineQueue: true,
          connectTimeout: this.isProduction ? 3000 : 500,
          retryStrategy: this.isProduction
            ? (times: number) => Math.min(times * 200, 2000)
            : () => null,
        });
        this.subscriber.on('error', (err: Error) => {
          this.logger.warn(`Evento de erro no assinante Redis Pub/Sub: ${err.message}`);
        });
        this.subscriber.on('message', (msgChannel: string, message: string) => {
          try {
            const parsed: unknown = JSON.parse(message);
            this.dispatchLocal(msgChannel, parsed);
          } catch (error) {
            this.logger.warn(
              `Mensagem Pub/Sub invalida no canal '${msgChannel}': ${this.describeError(error)}`,
            );
          }
        });
      }
      await this.ensureConnected(this.subscriber);
      await this.subscriber.subscribe(channel);
    } catch (error) {
      this.logger.warn(
        `Falha ao assinar canal Redis '${channel}' (operando em fallback local): ${this.describeError(error)}`,
      );
    }
  }

  async flushDb(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.ensureConnected(this.client);
      await this.client.flushdb();
    } catch (error) {
      this.logger.warn(`Falha ao limpar banco Redis: ${this.describeError(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.handlers.clear();
    await this.closeRedisConnection(this.subscriber);
    this.subscriber = null;
    await this.closeRedisConnection(this.client);
  }

  private async ensureConnected(conn: Redis): Promise<void> {
    if (conn.status === 'wait' && typeof conn.connect === 'function') {
      await conn.connect();
    }
  }

  private dispatchLocal(channel: string, payload: unknown): void {
    const channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) return;
    for (const handler of channelHandlers) {
      handler(payload);
    }
  }

  private async closeRedisConnection(conn: Redis | null): Promise<void> {
    if (!conn) {
      return;
    }

    if (conn.status === 'wait' || conn.status === 'end') {
      conn.disconnect();
      return;
    }

    try {
      await conn.quit();
    } catch {
      conn.disconnect();
    }
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
