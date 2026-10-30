import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CakeFormat, IngredientType, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

import { Role } from '../common/enums/role.enum';
import { PixGatewayPort } from '../payments/pix-gateway.port';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

const massaId = '11111111-1111-4111-8111-111111111111';
const coberturaId = '22222222-2222-4222-8222-222222222222';
const recheioId = '33333333-3333-4333-8333-333333333333';

const catalogIngredients = [
  {
    id: massaId,
    name: 'Massa de Chocolate',
    type: IngredientType.MASSA,
    pricePerKg: new Prisma.Decimal('38.00'),
    active: true,
    isAerated: false,
    allergens: ['gluten', 'ovos'],
  },
  {
    id: coberturaId,
    name: 'Chantilly',
    type: IngredientType.COBERTURA,
    pricePerKg: new Prisma.Decimal('50.00'),
    active: true,
    isAerated: false,
    allergens: ['leite'],
  },
  {
    id: recheioId,
    name: 'Geleia de Frutas Vermelhas',
    type: IngredientType.RECHEIO,
    pricePerKg: new Prisma.Decimal('48.00'),
    active: true,
    isAerated: false,
    allergens: [],
  },
];

describe('OrdersService (UC01, RF02-RF07, RN01-RN03)', () => {
  const userFindUnique = jest.fn();
  const ingredientFindMany = jest.fn();
  const orderCreate = jest.fn();
  const orderFindUnique = jest.fn();
  const orderFindMany = jest.fn();
  const orderUpdate = jest.fn();
  const paymentUpdate = jest.fn();
  const paymentUpsert = jest.fn();

  const prismaMock = {
    user: { findUnique: userFindUnique },
    ingredient: { findMany: ingredientFindMany },
    order: {
      create: orderCreate,
      findUnique: orderFindUnique,
      findMany: orderFindMany,
      update: orderUpdate,
    },
    payment: {
      update: paymentUpdate,
      upsert: paymentUpsert,
    },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        order: { create: orderCreate, update: orderUpdate },
        payment: { update: paymentUpdate, upsert: paymentUpsert },
      }),
    ),
  } as unknown as PrismaService;

  const createPixChargeMock = jest.fn();
  const refundChargeMock = jest.fn();

  const pixGatewayMock: PixGatewayPort = {
    createPixCharge: createPixChargeMock,
    refundCharge: refundChargeMock,
  };

  let pricingService: PricingService;
  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    pricingService = new PricingService(prismaMock);
    service = new OrdersService(prismaMock, pricingService, pixGatewayMock);

    userFindUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Mariana Silva',
      email: 'mariana@example.com',
      anonymizedAt: null,
    });
    ingredientFindMany.mockResolvedValue(catalogIngredients);
    createPixChargeMock.mockResolvedValue({
      gatewayProvider: 'ASAAS',
      gatewayReference: 'pay_101',
      qrCode: 'data:image/png;base64,AAA',
      copyPasteCode: '000201PIX',
    });
  });

  it('recalcula o preco no servidor, gera cobranca PIX Asaas e grava Order + Snapshots + Payment em transacao', async () => {
    orderCreate.mockImplementation(({ data }: { data: { id: string; totalPrice: number } }) =>
      Promise.resolve({
        id: data.id,
        userId: 'user-1',
        status: OrderStatus.AGUARDANDO_PAGAMENTO,
        totalPrice: new Prisma.Decimal(data.totalPrice.toFixed(2)),
        toppingMessage: 'Parabens!',
        riceImageUrl: null,
        deliveryAddress: 'Rua das Palmeiras, 100',
        createdAt: new Date('2026-10-28T20:00:00.000Z'),
        updatedAt: new Date('2026-10-28T20:00:00.000Z'),
        cakeConfiguration: {
          id: 'cfg-1',
          format: CakeFormat.REDONDO,
          floorsCount: 1,
          colorHex: '#F3EDE3',
          dietaryFlags: [],
          layers: [],
        },
        items: [
          {
            id: 'item-1',
            ingredientId: massaId,
            ingredientNameSnapshot: 'Massa de Chocolate',
            pricePerKgSnapshot: new Prisma.Decimal('38.00'),
            weightKg: new Prisma.Decimal('1.500'),
            subtotal: new Prisma.Decimal('57.00'),
          },
        ],
        payment: {
          id: 'pay-1',
          gatewayProvider: 'ASAAS',
          gatewayReference: 'pay_101',
          qrCode: 'data:image/png;base64,AAA',
          copyPasteCode: '000201PIX',
          status: PaymentStatus.PENDENTE,
          expiresAt: new Date('2026-10-28T20:15:00.000Z'),
          paidAt: null,
          refundedAt: null,
        },
      }),
    );

    const created = await service.createOrder('user-1', {
      format: CakeFormat.REDONDO,
      colorHex: '#F3EDE3',
      floors: [
        {
          floorNumber: 1,
          doughIngredientId: massaId,
          coverageIngredientId: coberturaId,
          fillingIngredientIds: [recheioId],
          estimatedWeightKg: 1.5,
        },
      ],
      toppingMessage: '  Parabens!  ',
      deliveryAddress: 'Rua das Palmeiras, 100',
    });

    // (38 + 50 + 48) * 1.5 + 25 = 136 * 1.5 + 25 = 204 + 25 = 229.00
    expect(createPixChargeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 229,
        customerEmail: 'mariana@example.com',
      }),
    );
    expect(created.totalPrice).toBe(229);
    expect(created.status).toBe(OrderStatus.AGUARDANDO_PAGAMENTO);
    expect(created.payment?.copyPasteCode).toBe('000201PIX');
  });

  it('bloqueia com 422 conflito entre restricao alimentar declarada (RF06) e alergenicos dos insumos', async () => {
    await expect(
      service.createOrder('user-1', {
        format: CakeFormat.REDONDO,
        colorHex: '#FFFFFF',
        dietaryFlags: ['lactose'],
        floors: [
          {
            floorNumber: 1,
            doughIngredientId: massaId,
            coverageIngredientId: coberturaId, // Chantilly contem 'leite' (conflita com lactose)
            fillingIngredientIds: [recheioId],
            estimatedWeightKg: 1,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(createPixChargeMock).not.toHaveBeenCalled();
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it('protege contra IDOR (403) quando outro cliente tenta ler ou cancelar pedido alheio', async () => {
    orderFindUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'dono-original',
      status: OrderStatus.AGUARDANDO_PAGAMENTO,
      totalPrice: new Prisma.Decimal('100.00'),
      items: [],
      payment: null,
      cakeConfiguration: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.findOrderById('order-1', { id: 'invasor', role: Role.CLIENTE }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.findOrderById('inexistente', { id: 'dono', role: Role.ADMIN }),
    ).resolves.toBeDefined();

    orderFindUnique.mockResolvedValueOnce(null);
    await expect(
      service.findOrderById('nao-existe', { id: 'dono', role: Role.CLIENTE }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('permite ao cliente cancelar livremente enquanto AGUARDANDO_PAGAMENTO, mas bloqueia apos entrar em producao', async () => {
    orderFindUnique.mockResolvedValueOnce({
      id: 'order-1',
      userId: 'user-1',
      status: OrderStatus.AGUARDANDO_PAGAMENTO,
      totalPrice: new Prisma.Decimal('100.00'),
      items: [],
      payment: { id: 'pay-1', status: PaymentStatus.PENDENTE, gatewayReference: 'pay_1' },
      cakeConfiguration: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    orderUpdate.mockResolvedValueOnce({
      id: 'order-1',
      userId: 'user-1',
      status: OrderStatus.CANCELADO,
      totalPrice: new Prisma.Decimal('100.00'),
      items: [],
      payment: {
        id: 'pay-1',
        gatewayProvider: 'ASAAS',
        gatewayReference: 'pay_1',
        qrCode: null,
        copyPasteCode: null,
        status: PaymentStatus.EXPIRADO,
        expiresAt: new Date(),
        paidAt: null,
        refundedAt: null,
      },
      cakeConfiguration: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const cancelled = await service.cancelOrder('order-1', { id: 'user-1', role: Role.CLIENTE });
    expect(cancelled.status).toBe(OrderStatus.CANCELADO);

    orderFindUnique.mockResolvedValueOnce({
      id: 'order-2',
      userId: 'user-1',
      status: OrderStatus.EM_PRODUCAO,
      totalPrice: new Prisma.Decimal('100.00'),
      items: [],
      payment: { id: 'pay-2', status: PaymentStatus.PAGO, gatewayReference: 'pay_2' },
      cakeConfiguration: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.cancelOrder('order-2', { id: 'user-1', role: Role.CLIENTE }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('lista pedidos do cliente expirando PIX vencido, permite regenerar PIX e permite ao ADMIN cancelar pedido pago com estorno', async () => {
    const expiredDate = new Date(Date.now() - 60_000);
    const pendingExpiredOrder = {
      id: 'order-exp',
      userId: 'user-1',
      status: OrderStatus.AGUARDANDO_PAGAMENTO,
      totalPrice: new Prisma.Decimal('150.00'),
      toppingMessage: null,
      riceImageUrl: null,
      deliveryAddress: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      cakeConfiguration: {
        id: 'cfg-exp',
        format: CakeFormat.REDONDO,
        floorsCount: 1,
        colorHex: '#FAF7F2',
        dietaryFlags: [],
        layers: [
          {
            id: 'layer-1',
            floorNumber: 1,
            doughIngredientId: massaId,
            coverageIngredientId: coberturaId,
            estimatedWeightKg: new Prisma.Decimal('1.000'),
            fillings: [{ ingredientId: recheioId }],
          },
        ],
      },
      items: [],
      payment: {
        id: 'pay-exp',
        gatewayProvider: 'ASAAS',
        gatewayReference: 'pay_old',
        qrCode: 'old',
        copyPasteCode: 'old',
        status: PaymentStatus.PENDENTE,
        expiresAt: expiredDate,
        paidAt: null,
        refundedAt: null,
      },
    };

    orderFindMany.mockResolvedValueOnce([pendingExpiredOrder]);
    paymentUpdate.mockResolvedValueOnce({
      ...pendingExpiredOrder.payment,
      status: PaymentStatus.EXPIRADO,
    });

    const list = await service.findMyOrders('user-1');
    expect(list).toHaveLength(1);
    expect(list[0]?.payment?.status).toBe(PaymentStatus.EXPIRADO);
    expect(list[0]?.cakeConfiguration?.layers[0]?.fillingIngredientIds).toEqual([recheioId]);

    // Regenera PIX enquanto AGUARDANDO_PAGAMENTO.
    orderFindUnique
      .mockResolvedValueOnce({
        ...pendingExpiredOrder,
        payment: { ...pendingExpiredOrder.payment, status: PaymentStatus.EXPIRADO },
      })
      .mockResolvedValueOnce({
        ...pendingExpiredOrder,
        payment: {
          ...pendingExpiredOrder.payment,
          gatewayReference: 'pay_101',
          status: PaymentStatus.PENDENTE,
          expiresAt: new Date(Date.now() + 900_000),
        },
      });
    paymentUpsert.mockResolvedValueOnce({});

    const regenerated = await service.regeneratePixCharge('order-exp', {
      id: 'user-1',
      role: Role.CLIENTE,
    });
    expect(regenerated.payment?.status).toBe(PaymentStatus.PENDENTE);
    expect(paymentUpsert).toHaveBeenCalledTimes(1);

    // ADMIN cancela pedido em EM_ESPERA ja pago, acionando estorno no gateway PIX.
    const paidWaitingOrder = {
      ...pendingExpiredOrder,
      id: 'order-paid',
      status: OrderStatus.EM_ESPERA,
      payment: {
        ...pendingExpiredOrder.payment,
        id: 'pay-paid',
        gatewayReference: 'pay_paid_ref',
        status: PaymentStatus.PAGO,
      },
    };
    orderFindUnique.mockResolvedValueOnce(paidWaitingOrder);
    orderUpdate.mockResolvedValueOnce({
      ...paidWaitingOrder,
      status: OrderStatus.CANCELADO,
      payment: { ...paidWaitingOrder.payment, status: PaymentStatus.ESTORNADO },
    });

    const refunded = await service.cancelOrder('order-paid', {
      id: 'admin-1',
      role: Role.ADMIN,
    });
    expect(refundChargeMock).toHaveBeenCalledWith('pay_paid_ref');
    expect(refunded.status).toBe(OrderStatus.CANCELADO);
  });
});
