import type { Response } from 'express';

import { Role } from '../common/enums/role.enum';
import { PaymentsController } from '../payments/payments.controller';
import { PaymentsService } from '../payments/payments.service';
import { UploadsController } from '../uploads/uploads.controller';
import { UploadsService } from '../uploads/uploads.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController, PaymentsController e UploadsController', () => {
  it('OrdersController delega create, findMine, findOne, cancel e regeneratePix ao OrdersService', async () => {
    const ordersServiceMock = {
      createOrder: jest.fn().mockResolvedValue({ id: 'o1' }),
      findMyOrders: jest.fn().mockResolvedValue([{ id: 'o1' }]),
      findOrderById: jest.fn().mockResolvedValue({ id: 'o1' }),
      cancelOrder: jest.fn().mockResolvedValue({ id: 'o1', status: 'CANCELADO' }),
      regeneratePixCharge: jest.fn().mockResolvedValue({ id: 'o1' }),
    } as unknown as OrdersService;

    const controller = new OrdersController(ordersServiceMock);
    const actor = { id: 'u1', email: 'm@e.com', role: Role.CLIENTE };

    await expect(
      controller.create(actor, {
        format: 'REDONDO',
        colorHex: '#FAF7F2',
        floors: [],
      }),
    ).resolves.toEqual({ id: 'o1' });
    await expect(controller.findMine(actor)).resolves.toEqual([{ id: 'o1' }]);
    await expect(controller.findOne('o1', actor)).resolves.toEqual({ id: 'o1' });
    await expect(controller.cancel('o1', actor)).resolves.toEqual({
      id: 'o1',
      status: 'CANCELADO',
    });
    await expect(controller.regeneratePix('o1', actor)).resolves.toEqual({ id: 'o1' });
  });

  it('PaymentsController delega o webhook do Asaas repassando o cabecalho asaas-access-token', async () => {
    const processAsaasWebhook = jest
      .fn()
      .mockResolvedValue({ received: true, status: 'PAID' as const });
    const paymentsServiceMock = {
      processAsaasWebhook,
    } as unknown as PaymentsService;

    const controller = new PaymentsController(paymentsServiceMock);
    const res = await controller.handleAsaasWebhook('tok-123', {
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_1' },
    });

    expect(res).toEqual({ received: true, status: 'PAID' });
    expect(processAsaasWebhook).toHaveBeenCalledWith('tok-123', {
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_1' },
    });
  });

  it('UploadsController delega upload e envia cabecalhos seguros (nosniff) na leitura da imagem', async () => {
    const uploadsServiceMock = {
      saveRicePaperImage: jest.fn().mockResolvedValue({
        url: '/api/uploads/rice-paper/id.png',
        mimeType: 'image/png',
        sizeBytes: 10,
      }),
      readRicePaperImage: jest.fn().mockResolvedValue({
        buffer: Buffer.from([1, 2, 3]),
        mimeType: 'image/png',
      }),
    } as unknown as UploadsService;

    const controller = new UploadsController(uploadsServiceMock);
    const saved = await controller.uploadRicePaper({
      buffer: Buffer.from([1]),
      size: 1,
      originalname: 'a.png',
    });
    expect(saved.mimeType).toBe('image/png');

    const setHeader = jest.fn();
    const send = jest.fn();
    const status = jest.fn(() => ({ send }));
    const res = { setHeader, status } as unknown as Response;

    await controller.getRicePaper('id.png', res);
    expect(setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(status).toHaveBeenCalledWith(200);
    expect(send).toHaveBeenCalled();
  });
});
