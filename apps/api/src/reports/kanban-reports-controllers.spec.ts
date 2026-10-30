import { OrderStatus } from '@prisma/client';
import type { Response } from 'express';

import { KanbanController } from '../kanban/kanban.controller';
import { KanbanService } from '../kanban/kanban.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('KanbanController & ReportsController (delegacao HTTP)', () => {
  it('KanbanController delega listQueue e updateStatus ao KanbanService', async () => {
    const listMock = jest.fn().mockResolvedValue([]);
    const transitionMock = jest.fn().mockResolvedValue({ id: 'ord-1', status: OrderStatus.PRONTO });
    const controller = new KanbanController({
      listProductionQueue: listMock,
      transitionOrderStatus: transitionMock,
    } as unknown as KanbanService);

    await expect(controller.listQueue()).resolves.toEqual([]);
    await expect(
      controller.updateStatus('ord-1', { status: OrderStatus.PRONTO }),
    ).resolves.toEqual({ id: 'ord-1', status: OrderStatus.PRONTO });
    expect(transitionMock).toHaveBeenCalledWith('ord-1', OrderStatus.PRONTO);
  });

  it('ReportsController delega getFinancial e envia Content-Disposition no download CSV', async () => {
    const getFinancialMock = jest.fn().mockResolvedValue({
      from: '2026-10-01',
      to: '2026-10-31',
      paidOrdersCount: 1,
      totalRevenue: 150,
      averageTicket: 150,
      orders: [],
    });
    const exportCsvMock = jest.fn().mockResolvedValue('\uFEFFcabecalho\r\n');
    const controller = new ReportsController({
      getFinancialReport: getFinancialMock,
      exportFinancialCsv: exportCsvMock,
    } as unknown as ReportsService);

    await expect(
      controller.getFinancial({ from: '2026-10-01', to: '2026-10-31' }),
    ).resolves.toMatchObject({ totalRevenue: 150 });

    const setHeaderMock = jest.fn();
    const sendMock = jest.fn();
    const res = { setHeader: setHeaderMock, send: sendMock } as unknown as Response;

    await controller.downloadFinancialCsv({ from: '2026-10-01', to: '2026-10-31' }, res);
    expect(setHeaderMock).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="relatorio-financeiro-2026-10-01_2026-10-31.csv"',
    );
    expect(sendMock).toHaveBeenCalledWith('\uFEFFcabecalho\r\n');

    await controller.downloadFinancialCsv({}, res);
    expect(setHeaderMock).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="relatorio-financeiro-ultimos-30-dias.csv"',
    );
  });
});
