import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus } from '@prisma/client';

import { AppEnvironment } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

const WEBHOOK_SECRET = 'segredo-webhook-asaas-super-seguro';

function makeConfig(): ConfigService<AppEnvironment, true> {
  return {
    get: jest.fn((key: string) => (key === 'ASAAS_WEBHOOK_TOKEN' ? WEBHOOK_SECRET : undefined)),
  } as unknown as ConfigService<AppEnvironment, true>;
}

describe('PaymentsService (RN03 / RNF06 - Webhook Asaas PIX)', () => {
  const paymentFindFirst = jest.fn();
  const paymentUpdate = jest.fn();
  const orderUpdate = jest.fn();

  const prismaMock = {
    payment: {
      findFirst: paymentFindFirst,
      update: paymentUpdate,
    },
    order: {
      update: orderUpdate,
    },
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        payment: { update: paymentUpdate },
        order: { update: orderUpdate },
      }),
    ),
  } as unknown as PrismaService;

  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentsService(prismaMock, makeConfig());
  });

  it('rejeita com 401 token de webhook ausente, de tamanho diferente ou invalido (timingSafeEqual)', () => {
    expect(() => service.verifyWebhookToken(undefined)).toThrow(UnauthorizedException);
    expect(() => service.verifyWebhookToken('curto')).toThrow(UnauthorizedException);
    expect(() =>
      service.verifyWebhookToken('segredo-webhook-asaas-super-errado'),
    ).toThrow(UnauthorizedException);

    expect(() => service.verifyWebhookToken(WEBHOOK_SECRET)).not.toThrow();
  });

  it('PAYMENT_RECEIVED confirma pagamento em transacao ACID e libera pedido para EM_ESPERA (RN03)', async () => {
    paymentFindFirst.mockResolvedValue({
      id: 'pay-db-1',
      orderId: 'order-1',
      status: PaymentStatus.PENDENTE,
      order: { id: 'order-1', status: OrderStatus.AGUARDANDO_PAGAMENTO },
    });

    const result = await service.processAsaasWebhook(WEBHOOK_SECRET, {
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_asaas_1', externalReference: 'order-1' },
    });

    expect(result).toEqual({ received: true, status: 'PAID' });
    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 'pay-db-1' },
      data: expect.objectContaining({ status: PaymentStatus.PAGO }),
    });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: OrderStatus.EM_ESPERA },
    });
  });

  it('e idempotente: webhook repetido de pagamento ja PAGO nao reexecuta mutacao', async () => {
    paymentFindFirst.mockResolvedValue({
      id: 'pay-db-1',
      orderId: 'order-1',
      status: PaymentStatus.PAGO,
      order: { id: 'order-1', status: OrderStatus.EM_PRODUCAO },
    });

    const result = await service.processAsaasWebhook(WEBHOOK_SECRET, {
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_asaas_1' },
    });

    expect(result).toEqual({ received: true, status: 'ALREADY_PAID' });
    expect(paymentUpdate).not.toHaveBeenCalled();
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it('trata PAYMENT_OVERDUE (expiracao), PAYMENT_REFUNDED (estorno) e cobranca desconhecida', async () => {
    paymentFindFirst.mockResolvedValueOnce(null);
    await expect(
      service.processAsaasWebhook(WEBHOOK_SECRET, {
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'desconhecido' },
      }),
    ).resolves.toEqual({ received: true, status: 'IGNORED' });

    paymentFindFirst.mockResolvedValueOnce({
      id: 'pay-db-2',
      orderId: 'order-2',
      status: PaymentStatus.PENDENTE,
      order: { id: 'order-2', status: OrderStatus.AGUARDANDO_PAGAMENTO },
    });
    await expect(
      service.processAsaasWebhook(WEBHOOK_SECRET, {
        event: 'PAYMENT_OVERDUE',
        payment: { id: 'pay_2' },
      }),
    ).resolves.toEqual({ received: true, status: 'EXPIRED' });
    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 'pay-db-2' },
      data: { status: PaymentStatus.EXPIRADO },
    });

    paymentFindFirst.mockResolvedValueOnce({
      id: 'pay-db-3',
      orderId: 'order-3',
      status: PaymentStatus.PAGO,
      order: { id: 'order-3', status: OrderStatus.EM_ESPERA },
    });
    await expect(
      service.processAsaasWebhook(WEBHOOK_SECRET, {
        event: 'PAYMENT_REFUNDED',
        payment: { id: 'pay_3' },
      }),
    ).resolves.toEqual({ received: true, status: 'REFUNDED' });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-3' },
      data: { status: OrderStatus.CANCELADO },
    });
  });
});
