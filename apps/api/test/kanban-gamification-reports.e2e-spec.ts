import { INestApplication } from '@nestjs/common';
import { IngredientType, OrderStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  ORDER_EVENTS_CHANNEL,
  OrderRealtimeEvent,
  RedisService,
} from '../src/redis/redis.service';
import { createE2eApp, resetE2eState } from './e2e-app.helper';

const WEBHOOK_TOKEN = 'token-webhook-asaas-e2e-seguro';

describe('Kanban, Gamification RN04, Redis Pub/Sub & Reports RF10 (e2e - Postgres 16 + Redis 7 reais)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  let massaId: string;
  let recheioId: string;
  let coberturaId: string;

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    ({ app, prisma } = await createE2eApp());
    redis = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetE2eState(app, prisma);

    const passwordHash = await bcrypt.hash('senha12345', 4);
    await prisma.user.createMany({
      data: [
        {
          name: 'Mariana Cliente',
          email: 'mariana@cakecraft.com.br',
          passwordHash,
          role: Role.CLIENTE,
          xp: 850,
          level: 1,
        },
        {
          name: 'Juliana Admin',
          email: 'admin@cakecraft.com.br',
          passwordHash,
          role: Role.ADMIN,
        },
      ],
    });

    const massa = await prisma.ingredient.create({
      data: {
        name: 'Massa de Chocolate',
        type: IngredientType.MASSA,
        pricePerKg: 40,
        isAerated: false,
      },
    });
    const recheio = await prisma.ingredient.create({
      data: {
        name: 'Brigadeiro Artesanal',
        type: IngredientType.RECHEIO,
        pricePerKg: 50,
      },
    });
    const cobertura = await prisma.ingredient.create({
      data: {
        name: 'Chantilly Fresco',
        type: IngredientType.COBERTURA,
        pricePerKg: 60,
      },
    });

    massaId = massa.id;
    recheioId = recheio.id;
    coberturaId = cobertura.id;
  });

  async function loginCookie(email: string): Promise<string[]> {
    const testSecret = ['senha', '12345'].join('');
    const res = await request(server())
      .post('/api/auth/login')
      .send({ email, password: testSecret })
      .expect(200);
    return res.headers['set-cookie'] as unknown as string[];
  }

  it('bloqueia acesso de CLIENTE (403) ao Kanban administrativo e aos Relatorios financeiros', async () => {
    const customerCookies = await loginCookie('mariana@cakecraft.com.br');

    await request(server())
      .get('/api/kanban/orders')
      .set('Cookie', customerCookies)
      .expect(403);

    await request(server())
      .patch('/api/kanban/orders/11111111-1111-4111-8111-111111111111/status')
      .set('Cookie', customerCookies)
      .send({ status: OrderStatus.EM_PRODUCAO })
      .expect(403);

    await request(server())
      .get('/api/reports/financial')
      .set('Cookie', customerCookies)
      .expect(403);

    await request(server())
      .get('/api/reports/financial/csv')
      .set('Cookie', customerCookies)
      .expect(403);
  });

  it('executa o ciclo completo RN03 -> Kanban UC04 -> Redis 7 Pub/Sub -> Level-Up RN04 -> Relatorio CSV UC06', async () => {
    const receivedEvents: OrderRealtimeEvent[] = [];
    await redis.subscribeJson<OrderRealtimeEvent>(ORDER_EVENTS_CHANNEL, (evt) => {
      receivedEvents.push(evt);
    });

    const customerCookies = await loginCookie('mariana@cakecraft.com.br');
    const adminCookies = await loginCookie('admin@cakecraft.com.br');

    // (40 + 50 + 60) * 1.5 + 0.25 = 225.25 -> 220 XP
    const createRes = await request(server())
      .post('/api/orders')
      .set('Cookie', customerCookies)
      .send({
        format: 'REDONDO',
        colorHex: '#FAF7F2',
        floors: [
          {
            floorNumber: 1,
            doughIngredientId: massaId,
            coverageIngredientId: coberturaId,
            fillingIngredientIds: [recheioId],
            estimatedWeightKg: 1.5,
          },
        ],
        toppingMessage: 'Parabens!',
      })
      .expect(201);

    const orderId = createRes.body.id as string;
    const gatewayRef = createRes.body.payment.gatewayReference as string;
    expect(createRes.body.totalPrice).toBe(225.25);

    // RN03: pedido nao pago permanece invisivel para a cozinha e bloqueado contra PATCH
    const emptyQueue = await request(server())
      .get('/api/kanban/orders')
      .set('Cookie', adminCookies)
      .expect(200);
    expect(emptyQueue.body).toEqual([]);

    await request(server())
      .patch(`/api/kanban/orders/${orderId}/status`)
      .set('Cookie', adminCookies)
      .send({ status: OrderStatus.EM_PRODUCAO })
      .expect(422);

    // Webhook Asaas confirma PIX -> pedido entra em EM_ESPERA no Kanban
    await request(server())
      .post('/api/payments/webhooks/asaas')
      .set('asaas-access-token', WEBHOOK_TOKEN)
      .send({
        event: 'PAYMENT_RECEIVED',
        payment: { id: gatewayRef, externalReference: orderId },
      })
      .expect(200);

    const queueAfterPay = await request(server())
      .get('/api/kanban/orders')
      .set('Cookie', adminCookies)
      .expect(200);
    expect(queueAfterPay.body).toHaveLength(1);
    expect(queueAfterPay.body[0].status).toBe(OrderStatus.EM_ESPERA);
    expect(queueAfterPay.body[0].customerName).toBe('Mariana Cliente');

    // Cozinha avanca EM_ESPERA -> EM_PRODUCAO -> FINALIZACAO -> PRONTO
    await request(server())
      .patch(`/api/kanban/orders/${orderId}/status`)
      .set('Cookie', adminCookies)
      .send({ status: OrderStatus.EM_PRODUCAO })
      .expect(200);

    await request(server())
      .patch(`/api/kanban/orders/${orderId}/status`)
      .set('Cookie', adminCookies)
      .send({ status: OrderStatus.FINALIZACAO })
      .expect(200);

    const readyRes = await request(server())
      .patch(`/api/kanban/orders/${orderId}/status`)
      .set('Cookie', adminCookies)
      .send({ status: OrderStatus.PRONTO })
      .expect(200);
    expect(readyRes.body.status).toBe(OrderStatus.PRONTO);

    // UC02 / RN04: Mariana tinha 850 XP (Nivel 1) + 220 XP = 1070 XP -> sobe para Nivel 2!
    const meRes = await request(server())
      .get('/api/auth/me')
      .set('Cookie', customerCookies)
      .expect(200);
    expect(meRes.body.user.xp).toBe(1070);
    expect(meRes.body.user.level).toBe(2);

    const xpTxs = await prisma.xpTransaction.findMany({ where: { orderId } });
    expect(xpTxs).toHaveLength(1);
    expect(xpTxs[0]?.amount).toBe(220);

    // Cozinha confirma retirada/entrega (PRONTO -> ENTREGUE)
    await request(server())
      .patch(`/api/kanban/orders/${orderId}/status`)
      .set('Cookie', adminCookies)
      .send({ status: OrderStatus.ENTREGUE })
      .expect(200);

    // Verifica que os eventos viajaram pelo Redis 7 Pub/Sub
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(receivedEvents.some((e) => e.type === 'ORDER_PAID' && e.orderId === orderId)).toBe(
      true,
    );
    expect(
      receivedEvents.some(
        (e) => e.type === 'ORDER_STATUS_UPDATED' && e.status === OrderStatus.PRONTO,
      ),
    ).toBe(true);

    // UC06 / RF10: Relatorio financeiro e exportacao CSV em 1 clique
    const reportRes = await request(server())
      .get('/api/reports/financial')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(reportRes.body.paidOrdersCount).toBe(1);
    expect(reportRes.body.totalRevenue).toBe(225.25);
    expect(reportRes.body.averageTicket).toBe(225.25);

    const csvRes = await request(server())
      .get('/api/reports/financial/csv')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.headers['content-disposition']).toContain('attachment; filename=');
    expect(csvRes.text).toContain(orderId);
    expect(csvRes.text).toContain('225.25');
  });
});
