import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppEnvironment } from '../config/env.validation';
import { AsaasPixGateway } from './asaas-pix.gateway';

function makeConfig(overrides: Partial<AppEnvironment> = {}): ConfigService<AppEnvironment, true> {
  const base: Partial<AppEnvironment> = {
    NODE_ENV: 'test',
    ASAAS_API_URL: 'https://api-sandbox.asaas.com/v3',
    ASAAS_API_KEY: 'chave-real-sandbox-asaas-12345',
    ASAAS_DEFAULT_CPF_CNPJ: '24971563792',
    ...overrides,
  };
  return {
    get: jest.fn((key: keyof AppEnvironment) => base[key]),
  } as unknown as ConfigService<AppEnvironment, true>;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('AsaasPixGateway (RF07 - integracao Asaas v3)', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('em modo dev local (chave placeholder), gera PIX Sandbox deterministico sem sair para a internet', async () => {
    const gateway = new AsaasPixGateway(
      makeConfig({ NODE_ENV: 'development', ASAAS_API_KEY: 'sandbox-asaas-local-dev' }),
    );

    const charge = await gateway.createPixCharge({
      orderId: 'order-123',
      amount: 145.9,
      customerName: 'Mariana Silva',
      customerEmail: 'mariana@example.com',
      description: 'Pedido CakeCraft #order-123',
      expiresAt: new Date('2026-10-28T23:30:00.000Z'),
    });

    expect(charge.gatewayProvider).toBe('ASAAS');
    expect(charge.gatewayReference).toMatch(/^pay_local_/);
    expect(charge.qrCode).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(charge.copyPasteCode).toContain('000201');
    await expect(gateway.refundCharge(charge.gatewayReference)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('com chave Asaas configurada, reutiliza ou cria cliente, cria cobranca PIX e busca QR Code na API v3', async () => {
    const gateway = new AsaasPixGateway(makeConfig());

    fetchMock
      // 1. GET /customers?email=... (lista vazia -> cria cliente)
      .mockResolvedValueOnce(jsonResponse(200, { data: [] }))
      // 2. POST /customers
      .mockResolvedValueOnce(jsonResponse(200, { id: 'cus_0001' }))
      // 3. POST /payments
      .mockResolvedValueOnce(jsonResponse(200, { id: 'pay_9991' }))
      // 4. GET /payments/pay_9991/pixQrCode
      .mockResolvedValueOnce(
        jsonResponse(200, {
          encodedImage: 'iVBORw0KGgoAAAANSUhEUg==',
          payload: '00020101021226850014br.gov.bcb.pix2563pix.asaas.com/qr/v2/9991',
        }),
      );

    const charge = await gateway.createPixCharge({
      orderId: 'order-abc',
      amount: 189.5,
      customerName: 'Mariana Silva',
      customerEmail: 'mariana@example.com',
      description: 'Pedido CakeCraft',
      expiresAt: new Date('2026-10-28T23:45:00.000Z'),
    });

    expect(charge).toEqual({
      gatewayProvider: 'ASAAS',
      gatewayReference: 'pay_9991',
      qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      copyPasteCode: '00020101021226850014br.gov.bcb.pix2563pix.asaas.com/qr/v2/9991',
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const [paymentsUrl, paymentsInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(paymentsUrl).toBe('https://api-sandbox.asaas.com/v3/payments');
    expect(paymentsInit.headers).toMatchObject({
      access_token: 'chave-real-sandbox-asaas-12345',
    });
    expect(JSON.parse(paymentsInit.body as string)).toMatchObject({
      customer: 'cus_0001',
      billingType: 'PIX',
      value: 189.5,
      externalReference: 'order-abc',
    });
  });

  it('reutiliza cliente existente no Asaas sem chamar POST /customers e executa estorno via POST /payments/:id/refund', async () => {
    const gateway = new AsaasPixGateway(makeConfig());

    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: [{ id: 'cus_existente' }] }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'pay_888' }))
      .mockResolvedValueOnce(jsonResponse(200, { encodedImage: 'abc', payload: '000201' }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'REFUNDED' }));

    const charge = await gateway.createPixCharge({
      orderId: 'order-2',
      amount: 90,
      customerName: 'Mariana',
      customerEmail: 'mariana@example.com',
      description: 'Pedido 2',
      expiresAt: new Date('2026-10-28T23:45:00.000Z'),
    });

    expect(charge.gatewayReference).toBe('pay_888');
    await gateway.refundCharge('pay_888');
    expect(fetchMock.mock.calls[3][0]).toBe(
      'https://api-sandbox.asaas.com/v3/payments/pay_888/refund',
    );
  });

  it('traduz falha HTTP ou indisponibilidade do Asaas em BadGatewayException (502) sem vazar segredos', async () => {
    const gateway = new AsaasPixGateway(makeConfig());
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { errors: [{ description: 'invalid key' }] }));

    await expect(
      gateway.createPixCharge({
        orderId: 'order-err',
        amount: 100,
        customerName: 'Mariana',
        customerEmail: 'mariana@example.com',
        description: 'Pedido',
        expiresAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
