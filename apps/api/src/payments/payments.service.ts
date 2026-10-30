import { timingSafeEqual } from 'node:crypto';

import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus } from '@prisma/client';

import { AppEnvironment } from '../config/env.validation';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_EVENTS_CHANNEL, OrderRealtimeEvent, RedisService } from '../redis/redis.service';
import { AsaasWebhookDto } from './dto/asaas-webhook.dto';

export interface WebhookProcessingResult {
  received: true;
  status: 'PAID' | 'ALREADY_PAID' | 'EXPIRED' | 'REFUNDED' | 'IGNORED';
}

const PAID_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
const EXPIRED_EVENTS = new Set(['PAYMENT_OVERDUE', 'PAYMENT_DELETED']);
const REFUNDED_EVENTS = new Set(['PAYMENT_REFUNDED']);

/**
 * Processador idempotente e transacional (RNF06) de webhooks do Asaas.
 *
 * Implementa a trava de producao RN03: um pedido nasce em AGUARDANDO_PAGAMENTO
 * (invisivel para a cozinha) e so transita para EM_ESPERA quando o webhook
 * autenticado confirma o pagamento PIX.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnvironment, true>,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  verifyWebhookToken(providedToken: string | undefined): void {
    const expectedToken = this.config.get('ASAAS_WEBHOOK_TOKEN', { infer: true });
    if (!providedToken) {
      throw new UnauthorizedException('Token de autenticacao do webhook ausente.');
    }

    const providedBuf = Buffer.from(providedToken, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');

    if (
      providedBuf.length !== expectedBuf.length ||
      !timingSafeEqual(providedBuf, expectedBuf)
    ) {
      throw new UnauthorizedException('Token de autenticacao do webhook invalido.');
    }
  }

  async processAsaasWebhook(
    providedToken: string | undefined,
    dto: AsaasWebhookDto,
  ): Promise<WebhookProcessingResult> {
    this.verifyWebhookToken(providedToken);
    this.metricsService?.recordPixWebhook(dto.event);

    const orClauses: Array<{ gatewayReference?: string; orderId?: string }> = [
      { gatewayReference: dto.payment.id },
    ];
    if (dto.payment.externalReference) {
      orClauses.push({ orderId: dto.payment.externalReference });
    }

    const record = await this.prisma.payment.findFirst({
      where: { OR: orClauses },
      include: { order: true },
    });

    if (!record) {
      return { received: true, status: 'IGNORED' };
    }

    if (PAID_EVENTS.has(dto.event)) {
      if (record.status === PaymentStatus.PAGO) {
        return { received: true, status: 'ALREADY_PAID' };
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: record.id },
          data: { status: PaymentStatus.PAGO, paidAt: new Date() },
        });

        if (record.order.status === OrderStatus.AGUARDANDO_PAGAMENTO) {
          await tx.order.update({
            where: { id: record.orderId },
            data: { status: OrderStatus.EM_ESPERA },
          });
        }
      });

      const nextStatus =
        record.order.status === OrderStatus.AGUARDANDO_PAGAMENTO
          ? OrderStatus.EM_ESPERA
          : record.order.status;
      await this.publishOrderEvent({
        type: 'ORDER_PAID',
        orderId: record.orderId,
        userId: record.order.userId,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });

      return { received: true, status: 'PAID' };
    }

    if (EXPIRED_EVENTS.has(dto.event)) {
      if (record.status === PaymentStatus.PENDENTE) {
        await this.prisma.payment.update({
          where: { id: record.id },
          data: { status: PaymentStatus.EXPIRADO },
        });
      }
      return { received: true, status: 'EXPIRED' };
    }

    if (REFUNDED_EVENTS.has(dto.event)) {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: record.id },
          data: { status: PaymentStatus.ESTORNADO, refundedAt: new Date() },
        });
        await tx.order.update({
          where: { id: record.orderId },
          data: { status: OrderStatus.CANCELADO },
        });
      });

      await this.publishOrderEvent({
        type: 'ORDER_CANCELLED',
        orderId: record.orderId,
        userId: record.order.userId,
        status: OrderStatus.CANCELADO,
        updatedAt: new Date().toISOString(),
      });

      return { received: true, status: 'REFUNDED' };
    }

    return { received: true, status: 'IGNORED' };
  }

  private async publishOrderEvent(event: OrderRealtimeEvent): Promise<void> {
    if (!this.redis) return;
    await this.redis.publishJson(ORDER_EVENTS_CHANNEL, event);
  }
}
