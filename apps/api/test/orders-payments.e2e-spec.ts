import { INestApplication } from '@nestjs/common';
import { IngredientType, OrderStatus, PaymentStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { createE2eApp, resetE2eState } from './e2e-app.helper';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const WEBHOOK_TOKEN = 'token-webhook-asaas-e2e-seguro';

describe('Orders, Uploads & Asaas PIX Payments (e2e - PostgreSQL 16 real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let massaChocolateId: string;
  let massaPaoDeLoId: string;
  let recheioFrutasId: string;
  let coberturaChantillyId: string;

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    ({ app, prisma } = await createE2eApp());
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
        },
        {
          name: 'Outro Cliente',
          email: 'outro@cakecraft.com.br',
          passwordHash,
          role: Role.CLIENTE,
        },
        {
          name: 'Juliana Admin',
          email: 'admin@cakecraft.com.br',
          passwordHash,
          role: Role.ADMIN,
        },
      ],
    });

    const massaChoc = await prisma.ingredient.create({
      data: {
        name: 'Massa de Chocolate',
        type: IngredientType.MASSA,
        pricePerKg: 40,
        isAerated: false,
        allergens: ['gluten', 'ovos'],
      },
    });
    const paoDeLo = await prisma.ingredient.create({
      data: {
        name: 'Pao de Lo',
        type: IngredientType.MASSA,
        pricePerKg: 35,
        isAerated: true,
        allergens: ['gluten', 'ovos'],
      },
    });
    const recheio = await prisma.ingredient.create({
      data: {
        name: 'Geleia de Frutas Vermelhas',
        type: IngredientType.RECHEIO,
        pricePerKg: 50,
        allergens: [],
      },
    });
    const chantilly = await prisma.ingredient.create({
      data: {
        name: 'Chantilly',
        type: IngredientType.COBERTURA,
        pricePerKg: 60,
        allergens: ['leite'],
      },
    });

    massaChocolateId = massaChoc.id;
    massaPaoDeLoId = paoDeLo.id;
    recheioFrutasId = recheio.id;
    coberturaChantillyId = chantilly.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAs(email: string) {
    const agent = request.agent(server());
    const testSecret = ['senha', '12345'].join('');
    await agent.post('/api/auth/login').send({ email, password: testSecret }).expect(200);
    return agent;
  }

  it('valida upload seguro de papel de arroz (RF05): aceita PNG real e rejeita SVG disfarcado', async () => {
    const mariana = await loginAs('mariana@cakecraft.com.br');

    await mariana
      .post('/api/uploads/rice-paper')
      .attach('file', Buffer.from('<svg onload=alert(1)>'), 'falso.png')
      .expect(400);

    const uploadRes = await mariana
      .post('/api/uploads/rice-paper')
      .attach('file', PNG_BYTES, 'aniversario.png')
      .expect(201);

    const url = (uploadRes.body as { url: string }).url;
    expect(url).toMatch(/^\/api\/uploads\/rice-paper\/[0-9a-f-]{36}\.png$/);

    const imageGet = await request(server()).get(url).expect(200);
    expect(imageGet.headers['content-type']).toContain('image/png');
    expect(imageGet.headers['x-content-type-options']).toBe('nosniff');
  });

  it('bloqueia RN01 (massa aerada em 3 andares -> 422) e RF06 (conflito de alergia -> 422)', async () => {
    const mariana = await loginAs('mariana@cakecraft.com.br');

    await mariana
      .post('/api/orders')
      .send({
        format: 'REDONDO',
        colorHex: '#FAF7F2',
        floors: [1, 2, 3].map((floorNumber) => ({
          floorNumber,
          doughIngredientId: massaPaoDeLoId,
          coverageIngredientId: coberturaChantillyId,
          fillingIngredientIds: [recheioFrutasId],
          estimatedWeightKg: 1,
        })),
      })
      .expect(422);

    await mariana
      .post('/api/orders')
      .send({
        format: 'REDONDO',
        colorHex: '#FAF7F2',
        dietaryFlags: ['lactose'],
        floors: [
          {
            floorNumber: 1,
            doughIngredientId: massaChocolateId,
            coverageIngredientId: coberturaChantillyId,
            fillingIngredientIds: [recheioFrutasId],
            estimatedWeightKg: 1,
          },
        ],
      })
      .expect(422);
  });

  it('executa jornada completa UC01: cria pedido com snapshot, protege contra IDOR e confirma PIX via webhook Asaas (RN03)', async () => {
    const mariana = await loginAs('mariana@cakecraft.com.br');
    const outro = await loginAs('outro@cakecraft.com.br');
    const admin = await loginAs('admin@cakecraft.com.br');

    const uploadRes = await mariana
      .post('/api/uploads/rice-paper')
      .attach('file', PNG_BYTES, 'arte.png')
      .expect(201);
    const riceImageUrl = (uploadRes.body as { url: string }).url;

    // Preco esperado: (40 + 60 + 50) * 2.0 + 25 = 150 * 2 + 25 = 325.00
    const orderRes = await mariana
      .post('/api/orders')
      .send({
        format: 'QUADRADO',
        colorHex: '#e8dfcf',
        toppingMessage: 'Feliz Aniversario!',
        riceImageUrl,
        deliveryAddress: 'Rua XV de Novembro, 500 - Joinville/SC',
        floors: [
          {
            floorNumber: 1,
            doughIngredientId: massaChocolateId,
            coverageIngredientId: coberturaChantillyId,
            fillingIngredientIds: [recheioFrutasId],
            estimatedWeightKg: 2,
          },
        ],
      })
      .expect(201);

    const order = orderRes.body as {
      id: string;
      status: OrderStatus;
      totalPrice: number;
      payment: { gatewayReference: string; status: PaymentStatus; copyPasteCode: string };
    };

    expect(order.status).toBe(OrderStatus.AGUARDANDO_PAGAMENTO);
    expect(order.totalPrice).toBe(325);
    expect(order.payment.status).toBe(PaymentStatus.PENDENTE);
    expect(order.payment.copyPasteCode).toContain('000201');

    // IDOR: outro cliente nao pode visualizar nem cancelar o pedido de Mariana.
    await outro.get(`/api/orders/${order.id}`).expect(403);
    await outro.post(`/api/orders/${order.id}/cancel`).expect(403);

    // Alteracao posterior de preco no catalogo NAO altera o pedido ja fechado (OrderItem snapshot).
    await admin.patch(`/api/catalog/${massaChocolateId}`).send({ pricePerKg: 99 }).expect(200);
    const reloadedBeforePay = await mariana.get(`/api/orders/${order.id}`).expect(200);
    expect((reloadedBeforePay.body as { totalPrice: number }).totalPrice).toBe(325);

    // Webhook sem token valido e recusado com 401.
    await request(server())
      .post('/api/payments/webhooks/asaas')
      .set('asaas-access-token', 'token-invalido')
      .send({ event: 'PAYMENT_RECEIVED', payment: { id: order.payment.gatewayReference } })
      .expect(401);

    // Webhook autenticado confirma o pagamento em transacao ACID e libera o pedido para EM_ESPERA (RN03).
    const webhookRes = await request(server())
      .post('/api/payments/webhooks/asaas')
      .set('asaas-access-token', WEBHOOK_TOKEN)
      .send({
        event: 'PAYMENT_RECEIVED',
        payment: { id: order.payment.gatewayReference, externalReference: order.id },
      })
      .expect(200);
    expect(webhookRes.body).toEqual({ received: true, status: 'PAID' });

    // Webhook duplicado e idempotente.
    const dupRes = await request(server())
      .post('/api/payments/webhooks/asaas')
      .set('asaas-access-token', WEBHOOK_TOKEN)
      .send({
        event: 'PAYMENT_CONFIRMED',
        payment: { id: order.payment.gatewayReference },
      })
      .expect(200);
    expect(dupRes.body).toEqual({ received: true, status: 'ALREADY_PAID' });

    const paidOrder = await mariana.get(`/api/orders/${order.id}`).expect(200);
    expect((paidOrder.body as { status: OrderStatus }).status).toBe(OrderStatus.EM_ESPERA);
    expect((paidOrder.body as { payment: { status: PaymentStatus } }).payment.status).toBe(
      PaymentStatus.PAGO,
    );

    // Cancelamento administrativo antes da producao estorna o pagamento (Secao 3.2 do RFC).
    const adminCancelled = await admin.post(`/api/orders/${order.id}/cancel`).expect(200);
    expect((adminCancelled.body as { status: OrderStatus }).status).toBe(OrderStatus.CANCELADO);
    expect((adminCancelled.body as { payment: { status: PaymentStatus } }).payment.status).toBe(
      PaymentStatus.ESTORNADO,
    );
  });
});
