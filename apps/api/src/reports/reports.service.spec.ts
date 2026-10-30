import { BadRequestException } from '@nestjs/common';
import { CakeFormat, OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ReportsService, sanitizeCsvCell } from './reports.service';

describe('ReportsService (UC06, RF10 - relatorio financeiro e exportacao CSV)', () => {
  const orderFindMany = jest.fn();
  const prismaMock = {
    order: { findMany: orderFindMany },
  } as unknown as PrismaService;

  let service: ReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService(prismaMock);
  });

  it('agrega receita confirmada, total de pedidos pagos e ticket medio em centavos inteiros', async () => {
    orderFindMany.mockResolvedValue([
      {
        id: 'ord-11111111',
        status: OrderStatus.PRONTO,
        totalPrice: new Prisma.Decimal('239.50'),
        createdAt: new Date('2026-10-15T14:00:00.000Z'),
        user: { name: 'Mariana Silva' },
        cakeConfiguration: { format: CakeFormat.REDONDO, floorsCount: 2 },
        payment: {
          paidAt: new Date('2026-10-15T14:05:00.000Z'),
          gatewayProvider: 'ASAAS',
          gatewayReference: 'pay_1',
        },
      },
      {
        id: 'ord-22222222',
        status: OrderStatus.EM_PRODUCAO,
        totalPrice: new Prisma.Decimal('160.50'),
        createdAt: new Date('2026-10-16T10:00:00.000Z'),
        user: { name: '=CMD("calc")' },
        cakeConfiguration: { format: CakeFormat.QUADRADO, floorsCount: 1 },
        payment: {
          paidAt: new Date('2026-10-16T10:02:00.000Z'),
          gatewayProvider: 'ASAAS',
          gatewayReference: 'pay_2',
        },
      },
    ]);

    const report = await service.getFinancialReport({
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(report.from).toBe('2026-10-01');
    expect(report.to).toBe('2026-10-31');
    expect(report.paidOrdersCount).toBe(2);
    expect(report.totalRevenue).toBe(400);
    expect(report.averageTicket).toBe(200);

    const csv = await service.exportFinancialCsv({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    // Reusa uma nova busca para exportacao
    orderFindMany.mockResolvedValueOnce([]);
    const emptyCsv = await service.exportFinancialCsv({});

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('pedido_id;data_pagamento;cliente;status;formato;andares;valor_brl;referencia_pix');
    // Protecao contra CSV Formula Injection (=CMD vira '=CMD)
    expect(csv).toContain(`"'=CMD(""calc"")"`);
    expect(emptyCsv.startsWith('\uFEFF')).toBe(true);
  });

  it('retorna ticket medio zero quando nao ha vendas no intervalo e rejeita datas invalidas (400)', async () => {
    orderFindMany.mockResolvedValueOnce([]);

    const empty = await service.getFinancialReport({});
    expect(empty.paidOrdersCount).toBe(0);
    expect(empty.totalRevenue).toBe(0);
    expect(empty.averageTicket).toBe(0);

    await expect(
      service.getFinancialReport({ from: '2026-10-20', to: '2026-10-10' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.getFinancialReport({ from: '2026-02-31', to: '2026-03-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sanitizeCsvCell neutraliza prefixos de formula (=, +, -, @) e escapa aspas duplas', () => {
    expect(sanitizeCsvCell('Mariana')).toBe('"Mariana"');
    expect(sanitizeCsvCell('+554799999')).toBe(`"'+554799999"`);
    expect(sanitizeCsvCell('@admin')).toBe(`"'@admin"`);
    expect(sanitizeCsvCell('Bolo "Especial"')).toBe('"Bolo ""Especial"""');
  });
});
