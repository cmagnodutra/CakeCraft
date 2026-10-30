import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CakeFormat, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

import { EmailService } from '../email/email.service';
import { GamificationService } from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_EVENTS_CHANNEL, RedisService } from '../redis/redis.service';
import { KanbanService } from './kanban.service';

function makeKanbanOrderRecord(status: OrderStatus = OrderStatus.EM_ESPERA) {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    userId: 'user-1',
    status,
    totalPrice: new Prisma.Decimal('250.00'),
    toppingMessage: 'Parabens!',
    riceImageUrl: '/api/uploads/rice-paper/11111111-1111-4111-8111-111111111111.png',
    deliveryAddress: 'Rua das Flores, 42',
    createdAt: new Date('2026-10-29T18:00:00.000Z'),
    updatedAt: new Date('2026-10-29T18:10:00.000Z'),
    user: {
      id: 'user-1',
      name: 'Mariana Silva',
      email: 'mariana@example.com',
      anonymizedAt: null,
    },
    cakeConfiguration: {
      id: 'cfg-1',
      format: CakeFormat.REDONDO,
      floorsCount: 1,
      colorHex: '#E8B4B8',
      dietaryFlags: ['lactose'],
      layers: [
        {
          id: 'layer-1',
          floorNumber: 1,
          estimatedWeightKg: new Prisma.Decimal('1.500'),
          doughIngredient: { name: 'Massa de Chocolate' },
          coverageIngredient: { name: 'Glace Vegetal' },
          fillings: [{ ingredient: { name: 'Geleia de Frutas' } }],
        },
      ],
    },
    items: [
      {
        id: 'item-1',
        ingredientId: 'ing-1',
        ingredientNameSnapshot: 'Massa de Chocolate',
        pricePerKgSnapshot: new Prisma.Decimal('38.00'),
        weightKg: new Prisma.Decimal('1.500'),
        subtotal: new Prisma.Decimal('57.00'),
      },
    ],
    payment: {
      status: PaymentStatus.PAGO,
      paidAt: new Date('2026-10-29T18:02:00.000Z'),
    },
  };
}

describe('KanbanService (UC04, RF08, RN03)', () => {
  const orderFindMany = jest.fn();
  const orderFindUnique = jest.fn();
  const orderUpdate = jest.fn();

  const prismaMock = {
    order: {
      findMany: orderFindMany,
      findUnique: orderFindUnique,
      update: orderUpdate,
    },
  } as unknown as PrismaService;

  const awardXpMock = jest.fn();
  const gamificationMock = {
    awardXpForCompletedOrder: awardXpMock,
  } as unknown as GamificationService;

  const sendOrderReadyEmailMock = jest.fn();
  const emailMock = {
    sendOrderReadyEmail: sendOrderReadyEmailMock,
  } as unknown as EmailService;

  const publishJsonMock = jest.fn();
  const redisMock = {
    publishJson: publishJsonMock,
  } as unknown as RedisService;

  let service: KanbanService;

  beforeEach(() => {
    jest.clearAllMocks();
    awardXpMock.mockResolvedValue({
      awarded: true,
      earnedXp: 250,
      totalXp: 250,
      previousLevel: 1,
      newLevel: 1,
      leveledUp: false,
    });
    sendOrderReadyEmailMock.mockResolvedValue(undefined);
    publishJsonMock.mockResolvedValue(undefined);
    service = new KanbanService(prismaMock, gamificationMock, emailMock, redisMock);
  });

  it('lista exclusivamente pedidos pagos da fila da cozinha em ordem FIFO (RN03)', async () => {
    orderFindMany.mockResolvedValueOnce([makeKanbanOrderRecord(OrderStatus.EM_ESPERA)]);

    const list = await service.listProductionQueue();

    expect(orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: {
            in: [
              OrderStatus.EM_ESPERA,
              OrderStatus.EM_PRODUCAO,
              OrderStatus.FINALIZACAO,
              OrderStatus.PRONTO,
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );
    expect(list).toHaveLength(1);
    expect(list[0]?.customerName).toBe('Mariana Silva');
    expect(list[0]?.cakeConfiguration?.layers[0]?.doughName).toBe('Massa de Chocolate');
    expect(list[0]?.cakeConfiguration?.layers[0]?.fillingNames).toEqual(['Geleia de Frutas']);
  });

  it('valida transicoes de coluna, bloqueia saltos invalidos ou pedido nao pago (422) e lanca 404 para inexistente', async () => {
    orderFindUnique.mockResolvedValueOnce(null);
    await expect(
      service.transitionOrderStatus('ausente', OrderStatus.EM_PRODUCAO),
    ).rejects.toBeInstanceOf(NotFoundException);

    // RN03: pedido ainda AGUARDANDO_PAGAMENTO nao pode entrar no Kanban
    orderFindUnique.mockResolvedValueOnce(
      makeKanbanOrderRecord(OrderStatus.AGUARDANDO_PAGAMENTO),
    );
    await expect(
      service.transitionOrderStatus('ord-unpaid', OrderStatus.EM_PRODUCAO),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    // Salto direto de EM_ESPERA para PRONTO sem passar por preparo/finalizacao
    orderFindUnique.mockResolvedValueOnce(makeKanbanOrderRecord(OrderStatus.EM_ESPERA));
    await expect(
      service.transitionOrderStatus('ord-1', OrderStatus.PRONTO),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('avanca EM_ESPERA -> EM_PRODUCAO publicando evento no Redis Pub/Sub sem acionar XP antes de PRONTO', async () => {
    orderFindUnique.mockResolvedValueOnce(makeKanbanOrderRecord(OrderStatus.EM_ESPERA));
    orderUpdate.mockResolvedValueOnce(makeKanbanOrderRecord(OrderStatus.EM_PRODUCAO));

    const updated = await service.transitionOrderStatus('ord-1', OrderStatus.EM_PRODUCAO);

    expect(updated.status).toBe(OrderStatus.EM_PRODUCAO);
    expect(awardXpMock).not.toHaveBeenCalled();
    expect(sendOrderReadyEmailMock).not.toHaveBeenCalled();
    expect(publishJsonMock).toHaveBeenCalledWith(
      ORDER_EVENTS_CHANNEL,
      expect.objectContaining({
        type: 'ORDER_STATUS_UPDATED',
        status: OrderStatus.EM_PRODUCAO,
      }),
    );
  });

  it('ao marcar como PRONTO (UC04 + UC02), concede XP, envia e-mail ao cliente e publica evento em tempo real', async () => {
    orderFindUnique.mockResolvedValueOnce(makeKanbanOrderRecord(OrderStatus.FINALIZACAO));
    orderUpdate.mockResolvedValueOnce(makeKanbanOrderRecord(OrderStatus.PRONTO));

    const ready = await service.transitionOrderStatus('ord-1', OrderStatus.PRONTO);

    expect(ready.status).toBe(OrderStatus.PRONTO);
    expect(awardXpMock).toHaveBeenCalledWith('11111111-2222-4333-8444-555555555555');
    expect(sendOrderReadyEmailMock).toHaveBeenCalledWith(
      'mariana@example.com',
      'Mariana Silva',
      '11111111-2222-4333-8444-555555555555',
    );
    expect(publishJsonMock).toHaveBeenCalledTimes(1);

    // Tolera falha SMTP no e-mail de pedido pronto sem reverter o status
    orderFindUnique.mockResolvedValueOnce(makeKanbanOrderRecord(OrderStatus.FINALIZACAO));
    orderUpdate.mockResolvedValueOnce(makeKanbanOrderRecord(OrderStatus.PRONTO));
    sendOrderReadyEmailMock.mockRejectedValueOnce(new Error('SMTP down'));

    await expect(
      service.transitionOrderStatus('ord-1', OrderStatus.PRONTO),
    ).resolves.toMatchObject({ status: OrderStatus.PRONTO });
  });
});
